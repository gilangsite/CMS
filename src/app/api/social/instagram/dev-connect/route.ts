import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { encryptToken } from '@/lib/encryption/token'
import { getCurrentUser } from '@/lib/auth/workspace'
import { logActivity } from '@/lib/activity-log'
import { apiUnauthorized, apiServerError, apiError } from '@/lib/api-response'

type MetaPage = {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: { id: string }
}

type MetaPagesResponse = {
  data?: MetaPage[]
  error?: { message?: string }
}

// ⚠️ DEV-ONLY: This endpoint bypasses OAuth and injects a token directly.
// It is only active when NODE_ENV is not 'production'.
// Usage: POST /api/social/instagram/dev-connect
// Body: { "accessToken": "YOUR_LONG_LIVED_TOKEN" }

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return apiError('This endpoint is not available in production', 403)
  }

  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const { accessToken } = body

    if (!accessToken || typeof accessToken !== 'string') {
      return apiError('accessToken is required in the request body')
    }

    // Strategy 1: Try as a User Token → get pages list
    const graphVersion = process.env.META_GRAPH_API_VERSION ?? 'v25.0'
    const pagesRes = await fetch(
      `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,instagram_business_account,access_token`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const pagesData = await pagesRes.json() as MetaPagesResponse

    let pageAccessToken: string
    let igAccountId: string

    const pages = (!pagesData.error && pagesData.data) ? pagesData.data : []
    const pageWithIg = pages.find((page) => page.instagram_business_account)

    if (pageWithIg?.access_token && pageWithIg.instagram_business_account) {
      // ✅ User Token with direct page admin
      pageAccessToken = pageWithIg.access_token
      igAccountId = pageWithIg.instagram_business_account.id
    } else {
      // Strategy 2: Try as a Page Token → call /me directly
      const pageDirectRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/me?fields=id,name,instagram_business_account`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const pageDirectData = await pageDirectRes.json() as MetaPage & {
        error?: { message?: string }
      }

      if (!pageDirectData.error && pageDirectData.instagram_business_account) {
        // ✅ Page Token
        pageAccessToken = accessToken
        igAccountId = pageDirectData.instagram_business_account.id
      } else {
        return Response.json({
          success: false,
          error: 'Could not find an Instagram Business Account linked to this token.',
          debug: {
            strategy1_pages: pages.length,
            strategy1_error: pagesData.error?.message ?? null,
            strategy2_response: pageDirectData,
            tip: 'Make sure you are using a Page Access Token (from /1182009824984705?fields=access_token) and Instagram is connected to the Page.',
          },
        }, { status: 400 })
      }
    }

    // 2. Fetch Instagram profile info
    const igRes = await fetch(
      `https://graph.facebook.com/${graphVersion}/${igAccountId}?fields=id,username,name,profile_picture_url`,
      { headers: { Authorization: `Bearer ${pageAccessToken}` } }
    )
    const igData = await igRes.json() as {
      username?: string
      name?: string
      profile_picture_url?: string
      error?: { message?: string }
    }

    if (igData.error) {
      return apiError(`Instagram API error: ${igData.error.message}`)
    }

    // 3. Find workspace membership
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    })
    if (!membership) {
      return apiError('No workspace found. Create a workspace first.')
    }

    // 4. Encrypt and store the token
    const encryptedToken = encryptToken(pageAccessToken)

    const account = await prisma.socialAccount.upsert({
      where: {
        platform_platformAccountId_workspaceId: {
          platform: 'INSTAGRAM',
          platformAccountId: igAccountId,
          workspaceId: membership.workspaceId,
        },
      },
      update: {
        username: igData.username,
        displayName: igData.name ?? igData.username,
        avatarUrl: igData.profile_picture_url ?? null,
        accessTokenEncrypted: encryptedToken,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
      },
      create: {
        workspaceId: membership.workspaceId,
        platform: 'INSTAGRAM',
        platformAccountId: igAccountId,
        username: igData.username,
        displayName: igData.name ?? igData.username,
        avatarUrl: igData.profile_picture_url ?? null,
        accessTokenEncrypted: encryptedToken,
        status: 'CONNECTED',
        scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
        lastSyncedAt: new Date(),
      },
    })

    await logActivity({
      workspaceId: membership.workspaceId,
      actorId: user.id,
      entityType: 'social_account',
      entityId: account.id,
      action: 'social_account.connected',
      metadata: { platform: 'INSTAGRAM', method: 'dev_token_inject', username: igData.username },
    })

    return Response.json({
      success: true,
      message: `✅ Instagram @${igData.username} berhasil dihubungkan!`,
      account: {
        id: account.id,
        username: igData.username,
        displayName: igData.name,
        platformAccountId: igAccountId,
      },
    })
  } catch (err) {
    return apiServerError(err)
  }
}
