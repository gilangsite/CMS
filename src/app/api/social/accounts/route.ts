import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) return apiError('workspaceId is required')

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId: user.id } })
    if (!member) return apiError('Not a member of this workspace', 403)

    const accounts = await prisma.socialAccount.findMany({
      where: { workspaceId },
      orderBy: { platform: 'asc' },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        accountType: true,
        scopes: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
        brandId: true,
        brand: { select: { id: true, name: true } },
        // NEVER expose encrypted tokens
      },
    })

    return apiSuccess(accounts)
  } catch (err) {
    return apiServerError(err)
  }
}
