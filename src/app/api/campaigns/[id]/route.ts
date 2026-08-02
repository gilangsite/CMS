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

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()
    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return apiNotFound('Campaign')
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: campaign.workspaceId, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'delete')) {
      return apiError('Insufficient permissions to delete campaigns', 403)
    }
    await prisma.campaign.delete({ where: { id } })
    return apiSuccess({ deleted: true })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
