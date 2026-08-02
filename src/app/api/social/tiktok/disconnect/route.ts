import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { logActivity } from '@/lib/activity-log'

export async function POST(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id') ?? req.nextUrl.pathname.split('/').at(-2) ?? ''
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const account = await prisma.socialAccount.findUnique({ where: { id } })
    if (!account) return apiError('Account not found', 404)

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: account.workspaceId, userId: user.id } })
    if (!member) return apiError('Not a member of this workspace', 403)

    await prisma.socialAccount.update({
      where: { id },
      data: { status: 'DISCONNECTED', updatedAt: new Date() },
    })

    await logActivity({ workspaceId: account.workspaceId, actorId: user.id, entityType: 'social_account', entityId: id, action: 'social_account.disconnected', metadata: { platform: account.platform } })
    return apiSuccess({ disconnected: true })
  } catch (err) {
    return apiServerError(err)
  }
}
