import {
  SocialPublisher,
  PlatformPost,
  ValidationResult,
  PublishResult,
} from '@/lib/platforms/types'

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v25.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`
const MAX_STATUS_ATTEMPTS = 24
const STATUS_POLL_INTERVAL_MS = 5_000

type MetaError = {
  message?: string
  code?: number
  error_subcode?: number
  type?: string
}

type MetaResponse = {
  id?: string
  permalink?: string
  status_code?: string
  status?: string
  error?: MetaError
}

function errorResult(prefix: string, error?: MetaError, fallbackCode?: string): PublishResult {
  const detail = error?.message ?? 'Unknown Meta API error'
  const code = error?.error_subcode ?? error?.code
  return {
    success: false,
    status: 'FAILED',
    errorCode: code?.toString() ?? fallbackCode,
    errorMessage: `${prefix}: ${detail}`,
  }
}

function isVideoMime(mimeType?: string): boolean {
  return mimeType?.startsWith('video/') ?? false
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Instagram publisher adapter.
 *
 * Uses official Meta Instagram Content Publishing API.
 * Mock publishing is only enabled by the explicit test environment flag.
 *
 * Official docs:
 * https://developers.facebook.com/docs/instagram-platform/content-publishing/
 */
export class InstagramPublisher implements SocialPublisher {
  async validate(post: PlatformPost): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!post.accessToken) {
      errors.push('Instagram account token is missing or expired. Please reconnect the account.')
    }
    const mediaUrls = post.mediaUrls?.length ? post.mediaUrls : post.mediaUrl ? [post.mediaUrl] : []
    if (mediaUrls.length === 0) {
      errors.push('No media asset is attached to this post.')
    }
    if (!post.platformAccountId) {
      errors.push('No Instagram account selected.')
    }

    // Destination-specific validation
    if (mediaUrls.some((url) => !isPublicHttpsUrl(url))) {
      errors.push('Instagram can only import media from a public HTTPS URL. Configure Vercel Blob for uploads.')
    }
    if (post.destination === 'instagram_reels' && !isVideoMime(post.mediaTypes?.[0] ?? post.mediaType)) {
      errors.push('Instagram Reels requires a video file.')
    }
    if (post.destination === 'instagram_carousel') {
      if (mediaUrls.length < 2) errors.push('Instagram carousel requires at least 2 media items.')
      if (mediaUrls.length > 10) errors.push('Instagram carousel supports at most 10 media items.')
    } else if (mediaUrls.length > 1) {
      errors.push('Select Instagram Carousel when attaching multiple media items.')
    }
    if ((post.caption?.length ?? 0) > 2200) {
      errors.push('Caption exceeds the Instagram 2,200 character limit.')
    }

    if (!process.env.META_APP_ID) {
      errors.push('Instagram API credentials are not configured.')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  async publish(post: PlatformPost): Promise<PublishResult> {
    if (process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true') {
      const { MockPublisher } = await import('@/lib/platforms/mock-publisher')
      const mock = new MockPublisher()
      return mock.publish(post)
    }

    const mediaUrls = post.mediaUrls?.length ? post.mediaUrls : post.mediaUrl ? [post.mediaUrl] : []
    const mediaTypes = post.mediaTypes?.length
      ? post.mediaTypes
      : mediaUrls.map((_url, index) => (index === 0 ? post.mediaType : undefined))

    if (!post.platformAccountId || !post.accessToken || mediaUrls.length === 0) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'missing_publish_data',
        errorMessage: 'Missing required post data (account, token, or media) for Instagram.',
      }
    }

    try {
      const childContainerIds: string[] = []

      if (post.destination === 'instagram_carousel') {
        for (let index = 0; index < mediaUrls.length; index++) {
          const child = await this.createContainer({
            accountId: post.platformAccountId,
            accessToken: post.accessToken,
            mediaUrl: mediaUrls[index],
            mimeType: mediaTypes[index],
            isCarouselItem: true,
          })
          if (!child.success || !child.id) {
            return errorResult('Instagram carousel item creation failed', child.error)
          }
          const ready = await this.waitForContainer(child.id, post.accessToken)
          if (!ready.success) return ready.result
          childContainerIds.push(child.id)
        }
      }

      const parent = await this.createContainer({
        accountId: post.platformAccountId,
        accessToken: post.accessToken,
        mediaUrl: mediaUrls[0],
        mimeType: mediaTypes[0],
        destination: post.destination,
        caption: post.caption ?? '',
        childContainerIds,
        collaborators: post.collaborators,
      })
      if (!parent.success || !parent.id) {
        return errorResult('Instagram container creation failed', parent.error)
      }

      const ready = await this.waitForContainer(parent.id, post.accessToken)
      if (!ready.success) return ready.result

      const publishData = await this.graphRequest<MetaResponse>(
        `/${post.platformAccountId}/media_publish`,
        post.accessToken,
        {
          method: 'POST',
          body: new URLSearchParams({ creation_id: parent.id }),
        }
      )
      if (!publishData.response.ok || publishData.data.error || !publishData.data.id) {
        return errorResult('Instagram publish failed', publishData.data.error, `http_${publishData.response.status}`)
      }

      const permalinkData = await this.graphRequest<MetaResponse>(
        `/${publishData.data.id}?fields=permalink`,
        post.accessToken
      )

      return {
        success: true,
        status: 'POSTED',
        platformMediaId: publishData.data.id,
        platformPostUrl: permalinkData.data.permalink,
      }
    } catch (err: unknown) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'instagram_network_error',
        errorMessage: err instanceof Error
          ? err.message
          : 'Unknown network error during Instagram publishing.',
      }
    }
  }

  private async createContainer(input: {
    accountId: string
    accessToken: string
    mediaUrl: string
    mimeType?: string
    destination?: string
    caption?: string
    isCarouselItem?: boolean
    childContainerIds?: string[]
    collaborators?: string[]
  }): Promise<{ success: boolean; id?: string; error?: MetaError }> {
    const params = new URLSearchParams()
    if (input.caption) params.set('caption', input.caption)
    if (input.collaborators?.length && input.destination !== 'instagram_story') {
      params.set('collaborators', JSON.stringify(input.collaborators))
    }

    if (input.childContainerIds?.length) {
      params.set('media_type', 'CAROUSEL')
      params.set('children', input.childContainerIds.join(','))
    } else {
      const video = isVideoMime(input.mimeType)
      params.set(video ? 'video_url' : 'image_url', input.mediaUrl)
      if (input.isCarouselItem) params.set('is_carousel_item', 'true')
      if (input.isCarouselItem && video) params.set('media_type', 'VIDEO')

      if (input.destination === 'instagram_reels') {
        params.set('media_type', 'REELS')
        params.set('share_to_feed', 'true')
      } else if (input.destination === 'instagram_story') {
        params.set('media_type', 'STORIES')
      } else if (video) {
        params.set('media_type', 'REELS')
        params.set('share_to_feed', 'true')
      }
    }

    const { response, data } = await this.graphRequest<MetaResponse>(
      `/${input.accountId}/media`,
      input.accessToken,
      { method: 'POST', body: params }
    )
    if (!response.ok || data.error || !data.id) {
      return { success: false, error: data.error ?? { message: `Meta returned HTTP ${response.status}` } }
    }
    return { success: true, id: data.id }
  }

  private async waitForContainer(
    containerId: string,
    accessToken: string
  ): Promise<{ success: true } | { success: false; result: PublishResult }> {
    for (let attempt = 0; attempt < MAX_STATUS_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS))
      }

      const { response, data } = await this.graphRequest<MetaResponse>(
        `/${containerId}?fields=status_code,status`,
        accessToken
      )
      if (!response.ok || data.error) {
        return {
          success: false,
          result: errorResult('Instagram container status check failed', data.error, `http_${response.status}`),
        }
      }
      if (data.status_code === 'FINISHED') return { success: true }
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        return {
          success: false,
          result: {
            success: false,
            status: 'FAILED',
            errorCode: `container_${data.status_code.toLowerCase()}`,
            errorMessage: data.status || `Instagram container ended with ${data.status_code}.`,
          },
        }
      }
    }

    return {
      success: false,
      result: {
        success: false,
        status: 'FAILED',
        errorCode: 'container_timeout',
        errorMessage: 'Instagram media processing timed out after 2 minutes.',
      },
    }
  }

  private async graphRequest<T extends MetaResponse>(
    path: string,
    accessToken: string,
    init: RequestInit = {}
  ): Promise<{ response: Response; data: T }> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    if (init.body instanceof URLSearchParams) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded')
    }
    const response = await fetch(`${GRAPH_API_BASE}${path}`, { ...init, headers })
    const data = await response.json() as T
    return { response, data }
  }
}
