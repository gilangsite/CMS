import type { SocialAccount } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import { decryptToken, encryptToken } from '@/lib/encryption/token'
import { logActivity } from '@/lib/activity-log'

export interface AccessTokenResult {
  success: boolean
  accessToken?: string
  errorCode?: string
  errorMessage?: string
}

type TikTokRefreshResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

export async function getValidAccessToken(
  account: SocialAccount
): Promise<AccessTokenResult> {
  let accessToken: string
  try {
    accessToken = decryptToken(account.accessTokenEncrypted)
  } catch {
    return {
      success: false,
      errorCode: 'token_decryption_failed',
      errorMessage: 'The account token cannot be decrypted. Reconnect the social account.',
    }
  }

  const expiresSoon =
    account.tokenExpiresAt !== null &&
    account.tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000
  if (!expiresSoon) return { success: true, accessToken }

  if (account.platform !== 'TIKTOK' || !account.refreshTokenEncrypted) {
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { status: 'EXPIRED' },
    })
    return {
      success: false,
      errorCode: 'access_token_expired',
      errorMessage: 'The social account token has expired. Reconnect the account and retry.',
    }
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) {
    return {
      success: false,
      errorCode: 'tiktok_not_configured',
      errorMessage: 'TikTok credentials are not configured for token refresh.',
    }
  }

  let refreshToken: string
  try {
    refreshToken = decryptToken(account.refreshTokenEncrypted)
  } catch {
    return {
      success: false,
      errorCode: 'refresh_token_decryption_failed',
      errorMessage: 'The TikTok refresh token cannot be decrypted. Reconnect the account.',
    }
  }

  try {
    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    const data = await response.json() as TikTokRefreshResponse
    if (!response.ok || data.error || !data.access_token) {
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { status: 'EXPIRED' },
      })
      return {
        success: false,
        errorCode: data.error || 'tiktok_refresh_failed',
        errorMessage:
          data.error_description || 'TikTok authorization expired. Reconnect the account.',
      }
    }

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEncrypted: encryptToken(data.access_token),
        refreshTokenEncrypted: encryptToken(data.refresh_token || refreshToken),
        tokenExpiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
        scopes: data.scope
          ? data.scope.split(',').map((scope) => scope.trim()).filter(Boolean)
          : account.scopes,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    })
    await logActivity({
      workspaceId: account.workspaceId,
      entityType: 'social_account',
      entityId: account.id,
      action: 'token.refreshed',
      metadata: { platform: 'TIKTOK' },
    })

    return { success: true, accessToken: data.access_token }
  } catch (error: unknown) {
    return {
      success: false,
      errorCode: 'tiktok_refresh_network_error',
      errorMessage:
        error instanceof Error ? error.message : 'TikTok token refresh failed unexpectedly.',
    }
  }
}
