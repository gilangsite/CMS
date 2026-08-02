import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/db/prisma'
import { encryptToken } from '@/lib/encryption/token'
import { logActivity } from '@/lib/activity-log'
import { verifyOAuthState } from '@/lib/oauth/state'

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v25.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

type TokenResponse = {
  access_token?: string
  expires_in?: number
  error?: { message?: string; code?: number }
}

type InstagramAccount = {
  id: string
  username?: string
  name?: string
  profile_picture_url?: string
  account_type?: string
}

type Page = {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: InstagramAccount
}

function redirectTo(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url))
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      return redirectTo(
        req,
        `/app/social-accounts?error=${encodeURIComponent(errorDescription || error)}`
      )
    }
    if (!code || !state) return redirectTo(req, '/app/social-accounts?error=missing_params')

    const { workspaceId, userId } = verifyOAuthState(state, 'instagram')
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    })
    if (!membership) return redirectTo(req, '/app/social-accounts?error=invalid_workspace')

    const metaAppId = process.env.META_APP_ID
    const metaAppSecret = process.env.META_APP_SECRET
    const metaRedirectUri =
      process.env.META_REDIRECT_URI ??
      new URL('/api/social/instagram/callback', req.nextUrl.origin).toString()
    if (!metaAppId || !metaAppSecret) throw new Error('Meta API credentials are missing')

    const tokenRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: metaAppId,
        redirect_uri: metaRedirectUri,
        client_secret: metaAppSecret,
        code,
      }),
    })
    const tokenData = await tokenRes.json() as TokenResponse
    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Meta token exchange failed')
    }

    const longTokenRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: metaAppId,
        client_secret: metaAppSecret,
        fb_exchange_token: tokenData.access_token,
      }),
    })
    const longTokenData = await longTokenRes.json() as TokenResponse
    const userToken = longTokenData.access_token || tokenData.access_token
    const tokenExpiresAt = longTokenData.expires_in
      ? new Date(Date.now() + longTokenData.expires_in * 1000)
      : null

    const fields =
      'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,account_type}'
    const pagesRes = await fetch(`${GRAPH_API_BASE}/me/accounts?fields=${encodeURIComponent(fields)}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    const pagesData = await pagesRes.json() as {
      data?: Page[]
      error?: { message?: string }
    }
    if (!pagesRes.ok || pagesData.error) {
      throw new Error(pagesData.error?.message || 'Unable to read Facebook Pages')
    }

    const page = pagesData.data?.find((candidate) => candidate.instagram_business_account)
    const igAccount = page?.instagram_business_account
    if (!page || !igAccount) {
      return redirectTo(
        req,
        '/app/social-accounts?error=no_instagram_business_account_found'
      )
    }

    const publishingToken = page.access_token || userToken
    const account = await prisma.socialAccount.upsert({
      where: {
        platform_platformAccountId_workspaceId: {
          platform: 'INSTAGRAM',
          platformAccountId: igAccount.id,
          workspaceId,
        },
      },
      update: {
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        accessTokenEncrypted: encryptToken(publishingToken),
        tokenExpiresAt: page.access_token ? null : tokenExpiresAt,
        username: igAccount.username,
        displayName: igAccount.name || igAccount.username,
        avatarUrl: igAccount.profile_picture_url,
        accountType: igAccount.account_type,
        scopes: [
          'instagram_basic',
          'instagram_content_publish',
          'pages_show_list',
          'pages_read_engagement',
        ],
      },
      create: {
        workspaceId,
        platform: 'INSTAGRAM',
        platformAccountId: igAccount.id,
        username: igAccount.username,
        displayName: igAccount.name || igAccount.username,
        avatarUrl: igAccount.profile_picture_url,
        accountType: igAccount.account_type,
        accessTokenEncrypted: encryptToken(publishingToken),
        tokenExpiresAt: page.access_token ? null : tokenExpiresAt,
        status: 'CONNECTED',
        scopes: [
          'instagram_basic',
          'instagram_content_publish',
          'pages_show_list',
          'pages_read_engagement',
        ],
        lastSyncedAt: new Date(),
      },
    })

    await logActivity({
      workspaceId,
      actorId: userId,
      entityType: 'social_account',
      entityId: account.id,
      action: 'social_account.connected',
      metadata: { platform: 'INSTAGRAM', real: true, pageId: page.id },
    })

    revalidatePath('/app/social-accounts')
    revalidatePath('/app/content/new')
    return redirectTo(req, '/app/social-accounts?connected=instagram')
  } catch (error: unknown) {
    console.error('[Instagram OAuth callback]', error)
    const message = error instanceof Error ? error.message : 'oauth_failed'
    return redirectTo(
      req,
      `/app/social-accounts?error=${encodeURIComponent(message.slice(0, 180))}`
    )
  }
}
