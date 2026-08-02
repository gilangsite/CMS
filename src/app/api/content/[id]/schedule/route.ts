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
      return apiError('Insufficient permissions to schedule content', 403)
    }

    const body = await req.json().catch(() => null) as { scheduledAt?: unknown } | null
    if (typeof body?.scheduledAt !== 'string') return apiError('scheduledAt is required')
    const scheduledAt = new Date(body.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) return apiError('scheduledAt is invalid')
    if (scheduledAt.getTime() <= Date.now() + 15_000) {
      return apiError('Scheduled time must be at least 15 seconds in the future')
    }

    if (item.contentAssets.length === 0) return apiError('Attach media before scheduling')
    if (item.platformPosts.length === 0) return apiError('Select a social account before scheduling')

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
      return apiError('Content must be approved before scheduling', 409)
    }

    await prisma.$transaction([
      prisma.contentItem.update({
        where: { id },
        data: {
          scheduledAt,
          publishingStatus: 'SCHEDULED',
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
            scheduledAt,
            status: 'SCHEDULED',
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
      action: 'content.scheduled',
      metadata: { scheduledAt: scheduledAt.toISOString(), autoApproved: autoApprove },
    })
    return apiSuccess({
      scheduled: true,
      scheduledAt: scheduledAt.toISOString(),
      autoApproved: autoApprove,
    })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
