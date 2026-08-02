import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { decryptToken } from '@/lib/encryption/token'
import {
  apiError,
  apiServerError,
  apiSuccess,
  apiUnauthorized,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v25.0'

type InstagramProfileResponse = {
  id?: string
  username?: string
  name?: string
  profile_picture_url?: string
  error?: { message?: string; code?: number }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') return apiError('Not found', 404)
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

    const account = await prisma.socialAccount.findFirst({
      where: { workspaceId: membership.workspaceId, platform: 'INSTAGRAM' },
    })
    if (!account) return apiError('No Instagram account is connected', 404)

    const token = decryptToken(account.accessTokenEncrypted)
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${account.platformAccountId}?fields=id,username,name,profile_picture_url`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await response.json() as InstagramProfileResponse
    if (!response.ok || data.error) {
      return apiError(data.error?.message ?? 'Instagram profile refresh failed', 502)
    }

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        username: data.username,
        displayName: data.name ?? data.username,
        avatarUrl: data.profile_picture_url ?? null,
        lastSyncedAt: new Date(),
      },
    })
    return apiSuccess({ refreshed: true, username: data.username })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
