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

    const assets = await prisma.mediaAsset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return apiSuccess(assets.map(a => ({ ...a, fileSize: a.fileSize?.toString() })))
  } catch (err) {
    return apiServerError(err)
  }
}
