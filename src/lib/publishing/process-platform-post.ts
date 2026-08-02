import { Platform, PublishingStatus } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import { InstagramPublisher } from '@/lib/platforms/instagram/publisher'
import { TikTokPublisher } from '@/lib/platforms/tiktok/publisher'
import { MockPublisher } from '@/lib/platforms/mock-publisher'
import { getValidAccessToken } from '@/lib/platforms/access-token'
import type {
  PlatformPost as PublisherPost,
  PublishResult,
  SocialPublisher,
} from '@/lib/platforms/types'
import { logActivity } from '@/lib/activity-log'
import { ensureInstagramCompatibleMedia } from '@/lib/media/instagram-compatible'

const CLAIMABLE_STATUSES: PublishingStatus[] = ['SCHEDULED', 'QUEUED', 'FAILED']
const TERMINAL_STATUSES: PublishingStatus[] = ['POSTED', 'CANCELLED', 'NEEDS_MANUAL_FINALIZATION']

export interface ProcessPlatformPostResult {
  platformPostId: string
  processed: boolean
  success: boolean
  status: PublishingStatus
  errorCode?: string
  errorMessage?: string
}

function getPublisher(platform: Platform): SocialPublisher {
  if (process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true') return new MockPublisher()
  return platform === 'INSTAGRAM' ? new InstagramPublisher() : new TikTokPublisher()
}

function normalizeTag(value: string, prefix: '#' | '@'): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`
}

function buildCaption(caption: string | null, hashtags: string[], mentions: string[]): string {
  const base = caption?.trim() ?? ''
  const suffix = [
    ...mentions.map((value) => normalizeTag(value, '@')),
    ...hashtags.map((value) => normalizeTag(value, '#')),
  ].filter((value) => value && !base.includes(value))

  return [base, suffix.join(' ')].filter(Boolean).join('\n\n')
}

function toSafeNumber(value: bigint | null): number | undefined {
  if (value === null) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

export async function syncContentPublishingStatus(contentItemId: string): Promise<void> {
  const posts = await prisma.platformPost.findMany({
    where: { contentItemId },
    select: { status: true },
  })
  if (posts.length === 0) return

  const statuses = posts.map((post) => post.status)
  let publishingStatus: PublishingStatus

  if (statuses.every((status) => status === 'POSTED')) publishingStatus = 'POSTED'
  else if (statuses.some((status) => status === 'FAILED')) publishingStatus = 'FAILED'
  else if (statuses.some((status) => status === 'POSTING')) publishingStatus = 'POSTING'
  else if (statuses.some((status) => status === 'PROCESSING')) publishingStatus = 'PROCESSING'
  else if (statuses.some((status) => status === 'QUEUED')) publishingStatus = 'QUEUED'
  else if (statuses.some((status) => status === 'SCHEDULED')) publishingStatus = 'SCHEDULED'
  else if (statuses.some((status) => status === 'NEEDS_MANUAL_FINALIZATION')) {
    publishingStatus = 'NEEDS_MANUAL_FINALIZATION'
  } else if (statuses.every((status) => status === 'CANCELLED')) publishingStatus = 'CANCELLED'
  else publishingStatus = 'DRAFT'

  await prisma.contentItem.update({
    where: { id: contentItemId },
    data: { publishingStatus },
  })
}

async function failPost(input: {
  platformPostId: string
  contentItemId: string
  workspaceId: string
  jobId?: string
  errorCode: string
  errorMessage: string
  platform: Platform
  destination: string
}): Promise<ProcessPlatformPostResult> {
  await prisma.$transaction([
    prisma.platformPost.update({
      where: { id: input.platformPostId },
      data: {
        status: 'FAILED',
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      },
    }),
    ...(input.jobId
      ? [
          prisma.publishingJob.update({
            where: { id: input.jobId },
            data: {
              status: 'FAILED',
              errorCode: input.errorCode,
              errorMessage: input.errorMessage,
            },
          }),
        ]
      : []),
  ])

  await syncContentPublishingStatus(input.contentItemId)
  await logActivity({
    workspaceId: input.workspaceId,
    entityType: 'platform_post',
    entityId: input.platformPostId,
    action: 'publishing.failed',
    metadata: {
      platform: input.platform,
      destination: input.destination,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    },
  })

  return {
    platformPostId: input.platformPostId,
    processed: true,
    success: false,
    status: 'FAILED',
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
  }
}

export async function processPlatformPost(
  platformPostId: string,
  expectedWorkspaceId?: string
): Promise<ProcessPlatformPostResult> {
  const snapshot = await prisma.platformPost.findUnique({
    where: { id: platformPostId },
    select: {
      id: true,
      status: true,
      contentItemId: true,
      platform: true,
      destination: true,
      contentItem: { select: { workspaceId: true } },
    },
  })
  if (!snapshot) {
    return {
      platformPostId,
      processed: false,
      success: false,
      status: 'FAILED',
      errorCode: 'post_not_found',
      errorMessage: 'Platform post was not found.',
    }
  }
  if (expectedWorkspaceId && snapshot.contentItem.workspaceId !== expectedWorkspaceId) {
    return {
      platformPostId,
      processed: false,
      success: false,
      status: snapshot.status,
      errorCode: 'workspace_mismatch',
      errorMessage: 'Publishing event does not belong to the expected workspace.',
    }
  }
  if (TERMINAL_STATUSES.includes(snapshot.status)) {
    return {
      platformPostId,
      processed: false,
      success: snapshot.status === 'POSTED' || snapshot.status === 'NEEDS_MANUAL_FINALIZATION',
      status: snapshot.status,
    }
  }

  const claimed = await prisma.platformPost.updateMany({
    where: {
      id: platformPostId,
      status: { in: CLAIMABLE_STATUSES },
    },
    data: {
      status: 'POSTING',
      lastAttemptAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  })
  if (claimed.count === 0) {
    const current = await prisma.platformPost.findUnique({
      where: { id: platformPostId },
      select: { status: true },
    })
    return {
      platformPostId,
      processed: false,
      success: current?.status === 'POSTED' || current?.status === 'NEEDS_MANUAL_FINALIZATION',
      status: current?.status ?? 'FAILED',
      errorCode: current ? 'already_processing' : 'post_not_found',
      errorMessage: current ? 'This post is already being processed.' : 'Platform post was not found.',
    }
  }

  const post = await prisma.platformPost.findUnique({
    where: { id: platformPostId },
    include: {
      socialAccount: true,
      contentItem: {
        include: {
          contentAssets: {
            include: { mediaAsset: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })
  if (!post) {
    return {
      platformPostId,
      processed: false,
      success: false,
      status: 'FAILED',
      errorCode: 'post_not_found',
      errorMessage: 'Platform post disappeared while publishing.',
    }
  }

  const workspaceId = post.contentItem.workspaceId
  const job = await prisma.publishingJob.create({
    data: {
      platformPostId,
      jobType: post.postMode === 'SEMI_AUTO' ? 'UPLOAD_DRAFT' : 'PUBLISH',
      status: 'RUNNING',
      attempts: 1,
      scheduledFor: post.scheduledAt ?? new Date(),
    },
  })

  await logActivity({
    workspaceId,
    entityType: 'platform_post',
    entityId: platformPostId,
    action: 'publishing.started',
    metadata: { platform: post.platform, destination: post.destination, jobId: job.id },
  })

  try {
    if (post.contentItem.approvalStatus !== 'APPROVED') {
      return await failPost({
        platformPostId,
        contentItemId: post.contentItemId,
        workspaceId,
        jobId: job.id,
        errorCode: 'approval_required',
        errorMessage: 'Content must be approved before it can be published.',
        platform: post.platform,
        destination: post.destination,
      })
    }
    if (post.socialAccount.status !== 'CONNECTED') {
      return await failPost({
        platformPostId,
        contentItemId: post.contentItemId,
        workspaceId,
        jobId: job.id,
        errorCode: 'account_disconnected',
        errorMessage: 'The selected social account is disconnected or expired.',
        platform: post.platform,
        destination: post.destination,
      })
    }
    const tokenResult = await getValidAccessToken(post.socialAccount)
    if (!tokenResult.success || !tokenResult.accessToken) {
      return await failPost({
        platformPostId,
        contentItemId: post.contentItemId,
        workspaceId,
        jobId: job.id,
        errorCode: tokenResult.errorCode ?? 'access_token_unavailable',
        errorMessage: tokenResult.errorMessage ?? 'The social account token is unavailable.',
        platform: post.platform,
        destination: post.destination,
      })
    }
    const accessToken = tokenResult.accessToken

    const assets = post.contentItem.contentAssets.map(({ mediaAsset }) => mediaAsset)
    const preparedAssets =
      post.platform === 'INSTAGRAM' &&
      process.env.NEXT_PUBLIC_MOCK_PUBLISHING !== 'true'
        ? await Promise.all(
            assets.map((asset) =>
              ensureInstagramCompatibleMedia(asset, post.destination)
            )
          )
        : assets.map((asset) => ({
            url: asset.fileUrl,
            mimeType: asset.mimeType ?? '',
            fileSize: toSafeNumber(asset.fileSize),
          }))
    const publisherPost: PublisherPost = {
      id: post.id,
      platform: post.platform,
      destination: post.destination,
      caption: buildCaption(post.caption, post.hashtags, post.mentions),
      hashtags: post.hashtags,
      mentions: post.mentions,
      collaborators: post.collaborators,
      postMode: post.postMode,
      privacyLevel: post.privacyLevel,
      allowComments: post.allowComments,
      allowDuet: post.allowDuet,
      allowStitch: post.allowStitch,
      commercialDisclosureEnabled: post.commercialDisclosureEnabled,
      commercialDisclosureType: post.commercialDisclosureType,
      musicUsageConfirmed: post.musicUsageConfirmed,
      userConsentConfirmed: post.userConsentConfirmed,
      coverTimestampMs: post.coverTimestampMs,
      mediaUrl: preparedAssets[0]?.url,
      mediaUrls: preparedAssets.map((asset) => asset.url),
      mediaType: preparedAssets[0]?.mimeType || undefined,
      mediaTypes: preparedAssets.map((asset) => asset.mimeType),
      fileSize: preparedAssets[0]?.fileSize,
      fileSizes: preparedAssets.map((asset) => asset.fileSize ?? 0),
      accessToken,
      platformAccountId: post.socialAccount.platformAccountId,
    }

    if (post.postMode === 'MANUAL_REMINDER') {
      const manualResult: PublishResult = {
        success: true,
        status: 'NEEDS_MANUAL_FINALIZATION',
      }
      return await saveSuccessfulResult(post, job.id, manualResult)
    }

    const publisher = getPublisher(post.platform)
    const validation = await publisher.validate(publisherPost)
    if (!validation.valid) {
      return await failPost({
        platformPostId,
        contentItemId: post.contentItemId,
        workspaceId,
        jobId: job.id,
        errorCode: 'validation_failed',
        errorMessage: validation.errors.join('; '),
        platform: post.platform,
        destination: post.destination,
      })
    }

    let result: PublishResult
    if (post.postMode === 'SEMI_AUTO') {
      if (!publisher.uploadDraft) {
        result = {
          success: true,
          status: 'NEEDS_MANUAL_FINALIZATION',
        }
      } else {
        const draft = await publisher.uploadDraft(publisherPost)
        result = {
          success: draft.success,
          status: draft.success ? 'PROCESSING' : 'FAILED',
          platformMediaId: draft.externalId,
          errorCode: draft.errorCode,
          errorMessage: draft.errorMessage,
        }
      }
    } else {
      result = await publisher.publish(publisherPost)
    }

    if (!result.success) {
      return await failPost({
        platformPostId,
        contentItemId: post.contentItemId,
        workspaceId,
        jobId: job.id,
        errorCode: result.errorCode ?? 'platform_publish_failed',
        errorMessage: result.errorMessage ?? `${post.platform} rejected the publish request.`,
        platform: post.platform,
        destination: post.destination,
      })
    }
    return await saveSuccessfulResult(post, job.id, result)
  } catch (error: unknown) {
    return await failPost({
      platformPostId,
      contentItemId: post.contentItemId,
      workspaceId,
      jobId: job.id,
      errorCode: 'unexpected_publish_error',
      errorMessage: error instanceof Error ? error.message : 'Unexpected publishing error.',
      platform: post.platform,
      destination: post.destination,
    })
  }
}

async function saveSuccessfulResult(
  post: {
    id: string
    contentItemId: string
    platform: Platform
    destination: string
    contentItem: { workspaceId: string }
  },
  jobId: string,
  result: PublishResult
): Promise<ProcessPlatformPostResult> {
  const status = result.status
  const published = status === 'POSTED'

  await prisma.$transaction([
    prisma.platformPost.update({
      where: { id: post.id },
      data: {
        status,
        platformMediaId: result.platformMediaId ?? null,
        platformPostUrl: result.platformPostUrl ?? null,
        errorCode: null,
        errorMessage: null,
        publishedAt: published ? new Date() : null,
      },
    }),
    prisma.publishingJob.update({
      where: { id: jobId },
      data: {
        status: 'SUCCEEDED',
        result: {
          status,
          platformMediaId: result.platformMediaId ?? null,
          platformPostUrl: result.platformPostUrl ?? null,
        },
      },
    }),
  ])

  await syncContentPublishingStatus(post.contentItemId)
  await logActivity({
    workspaceId: post.contentItem.workspaceId,
    entityType: 'platform_post',
    entityId: post.id,
    action: published ? 'publishing.succeeded' : 'publishing.draft_uploaded',
    metadata: {
      platform: post.platform,
      destination: post.destination,
      platformMediaId: result.platformMediaId ?? null,
      status,
    },
  })

  return {
    platformPostId: post.id,
    processed: true,
    success: true,
    status,
  }
}

export async function pollPlatformPostStatus(
  platformPostId: string
): Promise<ProcessPlatformPostResult> {
  const post = await prisma.platformPost.findUnique({
    where: { id: platformPostId },
    include: {
      socialAccount: true,
      contentItem: { select: { workspaceId: true } },
    },
  })
  if (!post || post.status !== 'PROCESSING' || !post.platformMediaId) {
    return {
      platformPostId,
      processed: false,
      success: false,
      status: post?.status ?? 'FAILED',
      errorCode: post ? 'not_processing' : 'post_not_found',
    }
  }

  const publisher = getPublisher(post.platform)
  if (!publisher.getStatus) {
    return {
      platformPostId,
      processed: false,
      success: false,
      status: post.status,
      errorCode: 'status_polling_unsupported',
    }
  }

  const tokenResult = await getValidAccessToken(post.socialAccount)
  if (!tokenResult.success || !tokenResult.accessToken) {
    return failPost({
      platformPostId,
      contentItemId: post.contentItemId,
      workspaceId: post.contentItem.workspaceId,
      errorCode: tokenResult.errorCode ?? 'access_token_unavailable',
      errorMessage: tokenResult.errorMessage ?? 'The social account token is unavailable.',
      platform: post.platform,
      destination: post.destination,
    })
  }

  const statusResult = await publisher.getStatus(post.platformMediaId, tokenResult.accessToken)
  if (statusResult.status === 'processing') {
    return {
      platformPostId,
      processed: true,
      success: true,
      status: 'PROCESSING',
    }
  }
  if (statusResult.status === 'failed') {
    return failPost({
      platformPostId,
      contentItemId: post.contentItemId,
      workspaceId: post.contentItem.workspaceId,
      errorCode: 'platform_processing_failed',
      errorMessage: statusResult.errorMessage ?? `${post.platform} media processing failed.`,
      platform: post.platform,
      destination: post.destination,
    })
  }

  const finalStatus: PublishingStatus =
    statusResult.status === 'posted' ? 'POSTED' : 'NEEDS_MANUAL_FINALIZATION'
  await prisma.platformPost.update({
    where: { id: platformPostId },
    data: {
      status: finalStatus,
      platformPostUrl: statusResult.platformPostUrl ?? post.platformPostUrl,
      publishedAt: finalStatus === 'POSTED' ? new Date() : null,
      errorCode: null,
      errorMessage: null,
    },
  })
  await syncContentPublishingStatus(post.contentItemId)
  await logActivity({
    workspaceId: post.contentItem.workspaceId,
    entityType: 'platform_post',
    entityId: platformPostId,
    action: finalStatus === 'POSTED' ? 'publishing.succeeded' : 'publishing.draft_uploaded',
    metadata: { platform: post.platform, status: finalStatus, source: 'status_poll' },
  })

  return {
    platformPostId,
    processed: true,
    success: true,
    status: finalStatus,
  }
}
