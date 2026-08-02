import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/db/prisma'
import { encryptToken } from '@/lib/encryption/token'
import { logActivity } from '@/lib/activity-log'
import { verifyOAuthState } from '@/lib/oauth/state'

// Real TikTok OAuth token exchange (Content Posting API v2).
// 1. Receive `code` and `state` params from TikTok
// 2. Exchange code for access + refresh token (PKCE: send back the
//    code_verifier that was paired with the code_challenge sent to
//    /authorize — see connect/route.ts)
// 3. Fetch the TikTok user's basic profile (open_id, display_name, avatar)
// 4. Encrypt and store tokens
//
// Docs: https://developers.tiktok.com/doc/oauth-user-access-token-management

const PKCE_COOKIE = 'tiktok_pkce_verifier'

function redirectTo(req: NextRequest, path: string, clearPkceCookie = false) {
  const res = NextResponse.redirect(new URL(path, req.url))
  if (clearPkceCookie) res.cookies.delete(PKCE_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return redirectTo(req, `/app/social-accounts?error=${encodeURIComponent(error)}`, true)
    }
    if (!code || !state) {
      return redirectTo(req, '/app/social-accounts?error=missing_params', true)
    }

    const codeVerifier = req.cookies.get(PKCE_COOKIE)?.value
    if (!codeVerifier) {
      return redirectTo(req, '/app/social-accounts?error=tiktok_pkce_expired', true)
    }

    const { workspaceId, userId } = verifyOAuthState(state, 'tiktok')
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    })
    if (!membership) {
      return redirectTo(req, '/app/social-accounts?error=invalid_workspace', true)
    }
    const clientKey = process.env.TIKTOK_CLIENT_KEY
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET
    const redirectUri =
      process.env.TIKTOK_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/social/tiktok/callback`

    if (!clientKey || !clientSecret) {
      throw new Error('TikTok API credentials missing for real OAuth flow')
    }

    // 1. Exchange code for access token
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(`Token Error: ${tokenData.error_description || tokenData.error || 'Unknown error'}`)
    }

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenData

    // 2. Fetch TikTok user profile
    const profileRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    const profileData = await profileRes.json()
    const profile = profileData.data?.user

    if (!profile) {
      return redirectTo(req, '/app/social-accounts?error=tiktok_profile_fetch_failed', true)
    }

    // 3. Save to database
    const encryptedAccessToken = encryptToken(access_token)
    const encryptedRefreshToken = refresh_token ? encryptToken(refresh_token) : null
    const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null

    const account = await prisma.socialAccount.upsert({
      where: {
        platform_platformAccountId_workspaceId: {
          platform: 'TIKTOK',
          platformAccountId: profile.open_id ?? open_id,
          workspaceId,
        },
      },
      update: {
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt,
        username: profile.display_name,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        scopes: typeof scope === 'string'
          ? scope.split(',').map((item: string) => item.trim()).filter(Boolean)
          : ['user.info.basic', 'video.upload'],
      },
      create: {
        workspaceId,
        platform: 'TIKTOK',
        platformAccountId: profile.open_id ?? open_id,
        username: profile.display_name,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt,
        status: 'CONNECTED',
        scopes: typeof scope === 'string'
          ? scope.split(',').map((item: string) => item.trim()).filter(Boolean)
          : ['user.info.basic', 'video.upload'],
        lastSyncedAt: new Date(),
      },
    })

    await logActivity({
      workspaceId,
      actorId: userId,
      entityType: 'social_account',
      entityId: account.id,
      action: 'social_account.connected',
      metadata: { platform: 'TIKTOK', real: true },
    })

    revalidatePath('/app/social-accounts')
    revalidatePath('/app/content/new')
    return redirectTo(req, '/app/social-accounts?connected=tiktok', true)
  } catch (error: unknown) {
    console.error('[TikTok OAuth callback]', error)
    const message = error instanceof Error ? error.message : 'oauth_failed'
    return redirectTo(
      req,
      `/app/social-accounts?error=${encodeURIComponent(message.slice(0, 180))}`,
      true
    )
  }
}
