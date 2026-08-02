import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { validateApprovalTransition } from '@/lib/state-machine/content'
import { logActivity } from '@/lib/activity-log'
import { hasPermission } from '@/lib/auth/permissions'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
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
    const canSubmit =
      hasPermission(member.role, 'submit_review') ||
      (item.createdBy === user.id && hasPermission(member.role, 'edit_own'))
    if (!canSubmit) return apiError('Insufficient permissions to submit content for review', 403)

    const transition = validateApprovalTransition(item.approvalStatus, 'IN_REVIEW')
    if (!transition.valid) return apiError(transition.error!)

    const updated = await prisma.contentItem.update({
      where: { id },
      data: { approvalStatus: 'IN_REVIEW', publishingStatus: 'PENDING_APPROVAL' },
    })

    await logActivity({ workspaceId: item.workspaceId, actorId: user.id, entityType: 'content_item', entityId: id, action: 'content.submitted_review' })
    return apiSuccess(updated)
  } catch (err) {
    return apiServerError(err)
  }
}
