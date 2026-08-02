import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { validateApprovalTransition } from '@/lib/state-machine/content'
import { logActivity } from '@/lib/activity-log'

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const item = await prisma.contentItem.findUnique({ where: { id } })
    if (!item) return apiNotFound('Content item')

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: item.workspaceId, userId: user.id } })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'approve')) return apiError('Insufficient permissions', 403)

    const transition = validateApprovalTransition(item.approvalStatus, 'REJECTED')
    if (!transition.valid) return apiError(transition.error!)

    const body = await req.json().catch(() => ({}))
    const { reason } = body

    await prisma.$transaction([
      prisma.contentItem.update({
        where: { id },
        data: { approvalStatus: 'REJECTED', publishingStatus: 'CANCELLED' },
      }),
      ...(reason ? [prisma.approvalComment.create({
        data: { contentItemId: id, userId: user.id, comment: `❌ Rejected: ${reason}` },
      })] : []),
    ])

    await logActivity({ workspaceId: item.workspaceId, actorId: user.id, entityType: 'content_item', entityId: id, action: 'content.rejected', metadata: { reason } })
    return apiSuccess({ rejected: true })
  } catch (err) {
    return apiServerError(err)
  }
}
