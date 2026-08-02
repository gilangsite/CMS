import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { validateApprovalTransition } from '@/lib/state-machine/content'
import { logActivity } from '@/lib/activity-log'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const item = await prisma.contentItem.findUnique({ 
      where: { id },
      include: { platformPosts: true }
    })
    if (!item) return apiNotFound('Content item')

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: item.workspaceId, userId: user.id } })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'approve')) return apiError('Insufficient permissions to approve content', 403)

    const transition = validateApprovalTransition(item.approvalStatus, 'APPROVED')
    if (!transition.valid) return apiError(transition.error!)

    const isScheduled = !!item.scheduledAt

    const [updated] = await prisma.$transaction([
      prisma.contentItem.update({
        where: { id },
        data: {
          approvalStatus: 'APPROVED',
          publishingStatus: isScheduled ? 'SCHEDULED' : 'APPROVED',
          approvedBy: user.id,
          approvedAt: new Date(),
        },
      }),
      ...(isScheduled
        ? item.platformPosts.map((post) =>
          prisma.platformPost.update({
            where: { id: post.id },
            data: { status: 'SCHEDULED', scheduledAt: item.scheduledAt },
          })
        )
        : []),
    ])

    await logActivity({ workspaceId: item.workspaceId, actorId: user.id, entityType: 'content_item', entityId: id, action: 'content.approved' })
    return apiSuccess(updated)
  } catch (err) {
    return apiServerError(err)
  }
}
