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
import { processPlatformPost } from '@/lib/publishing/process-platform-post'

export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const item = await prisma.contentItem.findUnique({
      where: { id },
      include: {
        contentAssets: { select: { id: true } },
        platformPosts: {
          include: {
            socialAccount: {
              select: { workspaceId: true, platform: true, status: true },
            },
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
      return apiError('Insufficient permissions to publish content', 403)
    }
    if (item.contentAssets.length === 0) return apiError('Attach media before publishing')
    if (item.platformPosts.length === 0) return apiError('Select a social account before publishing')

    const invalidAccount = item.platformPosts.find(
      (post) =>
        post.socialAccount.workspaceId !== item.workspaceId ||
        post.socialAccount.platform !== post.platform ||
        post.socialAccount.status !== 'CONNECTED'
    )
    if (invalidAccount) {
      return apiError('The selected social account is disconnected, expired, or belongs to another workspace')
    }

    const autoApprove = item.approvalStatus !== 'APPROVED'
    if (autoApprove && !hasPermission(member.role, 'approve')) {
      return apiError('Content must be approved before publishing', 409)
    }

    await prisma.$transaction([
      prisma.contentItem.update({
        where: { id },
        data: {
          scheduledAt: null,
          publishingStatus: 'QUEUED',
          ...(autoApprove
            ? {
                approvalStatus: 'APPROVED',
                approvedBy: user.id,
                approvedAt: new Date(),
              }
            : {}),
        },
      }),
      ...item.platformPosts.map((post) =>
        prisma.platformPost.update({
          where: { id: post.id },
          data: {
            scheduledAt: null,
            status: 'QUEUED',
            errorCode: null,
            errorMessage: null,
          },
        })
      ),
    ])

    await logActivity({
      workspaceId: item.workspaceId,
      actorId: user.id,
      entityType: 'content_item',
      entityId: id,
      action: 'publishing.retry_queued',
      metadata: { immediate: true, autoApproved: autoApprove },
    })

    const results = []
    for (const post of item.platformPosts) {
      results.push(await processPlatformPost(post.id, item.workspaceId))
    }

    const failed = results.find((result) => !result.success)
    if (failed) {
      return apiError(
        failed.errorMessage ?? 'The social platform rejected the publish request.',
        502,
        results
          .filter((result) => result.errorMessage)
          .map((result) => result.errorMessage as string)
      )
    }

    return apiSuccess({
      published: results.every((result) => result.status === 'POSTED'),
      processing: results.some((result) => result.status === 'PROCESSING'),
      needsManualFinalization: results.some(
        (result) => result.status === 'NEEDS_MANUAL_FINALIZATION'
      ),
      autoApproved: autoApprove,
      results,
    })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
