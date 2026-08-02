import {
  SocialPublisher,
  PlatformPost,
  ValidationResult,
  PublishResult,
  DraftUploadResult,
  PublishStatusResult,
} from '@/lib/platforms/types'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com'
const MIN_CHUNK_SIZE = 5 * 1024 * 1024
const TARGET_CHUNK_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024

type TikTokApiResponse = {
  data?: {
    publish_id?: string
    upload_url?: string
    status?: string
    fail_reason?: string
    publicly_available_post_id?: string[]
  }
  error?: {
    code?: string
    message?: string
    log_id?: string
  }
}

function apiError(data: TikTokApiResponse, fallback: string): DraftUploadResult {
  return {
    success: false,
    errorCode: data.error?.code,
    errorMessage: data.error?.message || fallback,
  }
}

function isPublicHttpsUrl(value?: string): boolean {
  if (!value) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * TikTok publisher adapter.
 *
 * Supports two modes:
 * A. Upload Draft (Semi-Auto) — MVP approach, TikTok sends notification to user to finalize.
 * B. Direct Post — Requires TikTok app audit (Phase 5).
 *
 * TikTok UX Compliance Requirements (Direct Post):
 * - Must display creator nickname
 * - Must fetch creator info before posting
 * - Must require manual privacy selection
 * - Must not enable interaction options by default
 * - Must require music usage confirmation
 * - Must show preview before upload
 * - Must get explicit user consent
 *
 * Official docs:
 * https://developers.tiktok.com/products/content-posting-api/
 */
export class TikTokPublisher implements SocialPublisher {
  async validate(post: PlatformPost): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!post.accessToken) {
      errors.push('TikTok account token is missing or expired. Please reconnect the account.')
    }
    if (!post.mediaUrl) {
      errors.push('No media asset is attached to this post.')
    }
    if (!post.platformAccountId) {
      errors.push('No TikTok account selected.')
    }

    if (!isPublicHttpsUrl(post.mediaUrl)) {
      errors.push('TikTok publishing requires a media file available from a public HTTPS URL.')
    }
    if (!post.mediaType?.startsWith('video/')) {
      errors.push('TikTok video publishing currently requires an MP4, MOV, or WebM video.')
    }
    if (!post.fileSize || post.fileSize <= 0) {
      errors.push('The uploaded video size is missing. Upload the file again before publishing.')
    } else if (post.fileSize > MAX_VIDEO_SIZE) {
      errors.push('TikTok videos must be 4 GB or smaller.')
    }

    if (post.postMode === 'AUTO_POST') {
      if (process.env.TIKTOK_DIRECT_POST_ENABLED !== 'true') {
        errors.push('TikTok Direct Post is not enabled for this app. Choose Semi-Auto upload.')
      }
      if (!post.privacyLevel) {
        errors.push('TikTok requires you to manually select a privacy option before posting.')
      }
      if (!post.musicUsageConfirmed) {
        errors.push('You must confirm TikTok Music Usage before posting.')
      }
      if (!post.userConsentConfirmed) {
        errors.push('Please confirm you have reviewed and approved this content for posting.')
      }
    }

    if (!process.env.TIKTOK_CLIENT_KEY) {
      errors.push('TikTok API credentials are not configured.')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  async publish(post: PlatformPost): Promise<PublishResult> {
    if (process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true') {
      const { MockPublisher } = await import('@/lib/platforms/mock-publisher')
      const mock = new MockPublisher()
      return mock.publish(post)
    }

    if (!post.accessToken || !post.mediaUrl || !post.fileSize) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'missing_publish_data',
        errorMessage: 'Missing TikTok token, media URL, or file size.',
      }
    }

    if (!post.privacyLevel || !post.musicUsageConfirmed || !post.userConsentConfirmed) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'consent_required',
        errorMessage: 'TikTok privacy, music usage, and user consent must be confirmed before Direct Post.',
      }
    }

    const result = await this.initializeAndUpload(post, '/v2/post/publish/video/init/', {
      post_info: {
        title: post.caption ?? '',
        privacy_level: post.privacyLevel,
        disable_comment: post.allowComments === false,
        disable_duet: post.allowDuet === false,
        disable_stitch: post.allowStitch === false,
        video_cover_timestamp_ms: post.coverTimestampMs ?? 0,
        brand_content_toggle: post.commercialDisclosureType === 'branded_content',
        brand_organic_toggle: post.commercialDisclosureType === 'your_brand',
      },
    })

    return {
      success: result.success,
      status: result.success ? 'PROCESSING' : 'FAILED',
      platformMediaId: result.externalId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    }
  }

  /**
   * Upload Content (Semi-Auto): pushes the video into the creator's TikTok
   * inbox as a draft. TikTok notifies the user in-app; they open TikTok and
   * tap "Post" to finalize. Does not require app audit approval — only
   * `video.upload` scope, which is granted on connect.
   *
   * Uses FILE_UPLOAD by default. PULL_FROM_URL only works after the media
   * domain has been verified in TikTok Developer settings, while Vercel Blob
   * hostnames are deployment-specific and commonly fail ownership checks.
   *
   * Docs: https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
   */
  async uploadDraft(post: PlatformPost): Promise<DraftUploadResult> {
    if (process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true') {
      const { MockPublisher } = await import('@/lib/platforms/mock-publisher')
      const mock = new MockPublisher()
      return mock.uploadDraft!(post)
    }

    if (!process.env.TIKTOK_CLIENT_KEY) {
      return {
        success: false,
        errorCode: 'tiktok_not_configured',
        errorMessage: 'TikTok API credentials are not configured.',
      }
    }

    if (!post.accessToken || !post.mediaUrl || !post.fileSize) {
      return {
        success: false,
        errorCode: 'missing_publish_data',
        errorMessage: 'Missing required post data (token, media URL, or file size) for TikTok.',
      }
    }

    return this.initializeAndUpload(post, '/v2/post/publish/inbox/video/init/')
  }

  private async initializeAndUpload(
    post: PlatformPost,
    endpoint: string,
    extraBody: Record<string, unknown> = {}
  ): Promise<DraftUploadResult> {
    try {
      if (!post.accessToken || !post.mediaUrl || !post.fileSize) {
        return {
          success: false,
          errorCode: 'missing_publish_data',
          errorMessage: 'TikTok upload is missing its token, media URL, or file size.',
        }
      }
      if (!isPublicHttpsUrl(post.mediaUrl)) {
        return {
          success: false,
          errorCode: 'media_url_not_public',
          errorMessage: 'TikTok upload requires a public HTTPS media URL.',
        }
      }

      const transfer = this.getTransferPlan(post.fileSize)
      const res = await fetch(`${TIKTOK_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${post.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          ...extraBody,
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: post.fileSize,
            chunk_size: transfer.chunkSize,
            total_chunk_count: transfer.totalChunks,
          },
        }),
      })
      const data = await res.json() as TikTokApiResponse

      if (!res.ok || (data.error?.code && data.error.code !== 'ok')) {
        return apiError(data, `TikTok upload initialization failed with HTTP ${res.status}.`)
      }
      if (!data.data?.publish_id || !data.data.upload_url) {
        return {
          success: false,
          errorCode: 'invalid_tiktok_response',
          errorMessage: 'TikTok did not return a publish ID and upload URL.',
        }
      }

      await this.uploadChunks({
        sourceUrl: post.mediaUrl,
        uploadUrl: data.data.upload_url,
        mimeType: post.mediaType ?? 'video/mp4',
        fileSize: post.fileSize,
        chunkSize: transfer.chunkSize,
        totalChunks: transfer.totalChunks,
      })

      return {
        success: true,
        externalId: data.data?.publish_id,
      }
    } catch (err: unknown) {
      return {
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Unknown network error during TikTok draft upload',
      }
    }
  }

  private getTransferPlan(fileSize: number): { chunkSize: number; totalChunks: number } {
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_VIDEO_SIZE) {
      throw new Error('TikTok video size must be between 1 byte and 4 GB.')
    }
    if (fileSize < MIN_CHUNK_SIZE) {
      return { chunkSize: fileSize, totalChunks: 1 }
    }

    const totalChunks = Math.ceil(fileSize / TARGET_CHUNK_SIZE)
    const chunkSize = Math.ceil(fileSize / totalChunks)
    return { chunkSize, totalChunks }
  }

  private async uploadChunks(input: {
    sourceUrl: string
    uploadUrl: string
    mimeType: string
    fileSize: number
    chunkSize: number
    totalChunks: number
  }): Promise<void> {
    for (let index = 0; index < input.totalChunks; index++) {
      const start = index * input.chunkSize
      const end = Math.min(input.fileSize - 1, start + input.chunkSize - 1)
      const expectedLength = end - start + 1
      const sourceRes = await fetch(input.sourceUrl, {
        headers: { Range: `bytes=${start}-${end}` },
      })
      if (!sourceRes.ok) {
        throw new Error(`Unable to read uploaded video (HTTP ${sourceRes.status}).`)
      }
      if (input.totalChunks > 1 && sourceRes.status !== 206) {
        throw new Error('Media storage does not support ranged downloads required for TikTok video upload.')
      }

      const chunk = Buffer.from(await sourceRes.arrayBuffer())
      if (chunk.byteLength !== expectedLength) {
        throw new Error(`Media chunk size mismatch: expected ${expectedLength}, received ${chunk.byteLength}.`)
      }

      const uploadRes = await fetch(input.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': input.mimeType,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end}/${input.fileSize}`,
        },
        body: chunk,
      })
      if (!uploadRes.ok) {
        const detail = (await uploadRes.text()).slice(0, 500)
        throw new Error(`TikTok media transfer failed (HTTP ${uploadRes.status}): ${detail}`)
      }
    }
  }

  /**
   * Polls TikTok's publish status endpoint. Requires the connected account's
   * access token (TikTok scopes status checks per-authorization).
   *
   * Docs: https://developers.tiktok.com/doc/content-posting-api-reference-get-post-status
   */
  async getStatus(externalPublishId: string, accessToken?: string): Promise<PublishStatusResult> {
    if (!process.env.TIKTOK_CLIENT_KEY || process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true' || !accessToken) {
      const { MockPublisher } = await import('@/lib/platforms/mock-publisher')
      const mock = new MockPublisher()
      return mock.getStatus!(externalPublishId)
    }

    try {
      const res = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: externalPublishId }),
      })
      const data = await res.json() as TikTokApiResponse
      if (!res.ok || (data.error?.code && data.error.code !== 'ok')) {
        return {
          status: 'failed',
          errorMessage: data.error?.message || `TikTok status check failed with HTTP ${res.status}.`,
        }
      }
      const status = data.data?.status as string | undefined

      if (status === 'FAILED') {
        return { status: 'failed', errorMessage: data.data?.fail_reason || 'TikTok publish failed' }
      }
      if (status === 'PUBLISH_COMPLETE') {
        return { status: 'posted' }
      }
      if (status === 'SEND_TO_USER_INBOX') return { status: 'manual_finalization' }
      return { status: 'processing' }
    } catch (err: unknown) {
      return {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Unknown network error checking TikTok status',
      }
    }
  }
}
