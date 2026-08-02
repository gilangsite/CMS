import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiNotFound,
  apiServerError,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity-log'
import { validatePublishingTransition } from '@/lib/state-machine/content'
import { processPlatformPost, syncContentPublishingStatus } from '@/lib/publishing/process-platform-post'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const body = (await req.json().catch(() => null)) as
      | { platformPostId?: unknown; action?: unknown }
      | null
    const platformPostId = body?.platformPostId
    const action = body?.action
    if (typeof platformPostId !== 'string' || !platformPostId) {
      return apiError('platformPostId is required')
    }
    if (action !== 'mark_posted' && action !== 'retry_auto') {
      return apiError("action must be 'mark_posted' or 'retry_auto'")
    }

    const item = await prisma.contentItem.findUnique({
      where: { id },
      include: {
        platformPosts: {
          include: {
            socialAccount: { select: { workspaceId: true, platform: true, status: true } },
          },
        },
      },
    })
    if (!item) return apiNotFound('Content item')

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: item.workspaceId, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'publish')) {
      return apiError('Insufficient permissions to finalize publishing for this content', 403)
    }

    const post = item.platformPosts.find((p) => p.id === platformPostId)
    if (!post) return apiNotFound('Platform post')

    if (action === 'mark_posted') {
      const transition = validatePublishingTransition(post.status, 'POSTED')
      if (!transition.valid) return apiError(transition.error ?? 'Invalid status transition', 409)

      await prisma.platformPost.update({
        where: { id: post.id },
        data: {
          status: 'POSTED',
          publishedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      })
      await syncContentPublishingStatus(item.id)
      await logActivity({
        workspaceId: item.workspaceId,
        actorId: user.id,
        entityType: 'platform_post',
        entityId: post.id,
        action: 'publishing.marked_posted',
        metadata: { platform: post.platform, destination: post.destination },
      })

      return apiSuccess({ status: 'POSTED' })
    }

    // retry_auto
    const transition = validatePublishingTransition(post.status, 'QUEUED')
    if (!transition.valid) return apiError(transition.error ?? 'Invalid status transition', 409)
    if (
      post.socialAccount.workspaceId !== item.workspaceId ||
      post.socialAccount.platform !== post.platform ||
      post.socialAccount.status !== 'CONNECTED'
    ) {
      return apiError('The selected social account is disconnected, expired, or belongs to another workspace')
    }

    await prisma.platformPost.update({
      where: { id: post.id },
      data: {
        postMode: 'AUTO_POST',
        status: 'QUEUED',
        errorCode: null,
        errorMessage: null,
      },
    })
    await logActivity({
      workspaceId: item.workspaceId,
      actorId: user.id,
      entityType: 'platform_post',
      entityId: post.id,
      action: 'publishing.retry_queued',
      metadata: { platform: post.platform, destination: post.destination, viaFinalize: true },
    })

    const result = await processPlatformPost(post.id, item.workspaceId)
    if (!result.success) {
      return apiError(
        result.errorMessage ?? 'The social platform rejected the publish request.',
        502
      )
    }

    return apiSuccess(result)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
