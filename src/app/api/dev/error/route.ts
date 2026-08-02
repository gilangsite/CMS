import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import {
  apiError,
  apiServerError,
  apiSuccess,
  apiUnauthorized,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return apiError('Not found', 404)
  }
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    })
    if (!membership) return apiError('No workspace found', 404)

    const post = await prisma.platformPost.findFirst({
      where: { contentItem: { workspaceId: membership.workspaceId } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        platform: true,
        destination: true,
        status: true,
        errorCode: true,
        errorMessage: true,
        lastAttemptAt: true,
        updatedAt: true,
      },
    })
    return apiSuccess(post)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
