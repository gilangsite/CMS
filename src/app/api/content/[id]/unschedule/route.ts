import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import {
  apiError,
  apiNotFound,
  apiServerError,
  apiSuccess,
  apiUnauthorized,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity-log'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const item = await prisma.contentItem.findUnique({
      where: { id },
      include: { platformPosts: { select: { id: true, status: true } } },
    })
    if (!item) return apiNotFound('Content item')

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: item.workspaceId, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'publish')) {
      return apiError('Insufficient permissions to change this schedule', 403)
    }
    if (['POSTED', 'POSTING', 'PROCESSING'].includes(item.publishingStatus)) {
      return apiError('Content that is already publishing cannot be unscheduled', 409)
    }

    await prisma.$transaction([
      prisma.contentItem.update({
        where: { id },
        data: {
          scheduledAt: null,
          publishingStatus: item.approvalStatus === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL',
        },
      }),
      ...item.platformPosts.map((post) =>
        prisma.platformPost.update({
          where: { id: post.id },
          data: {
            scheduledAt: null,
            status: item.approvalStatus === 'APPROVED' ? 'APPROVED' : 'PENDING_APPROVAL',
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
      action: 'content.unscheduled',
    })
    return apiSuccess({ unscheduled: true })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
