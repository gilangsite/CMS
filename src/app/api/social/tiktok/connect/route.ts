import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { randomBytes, createHash } from 'crypto'
import prisma from '@/lib/db/prisma'
import { apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { createOAuthState } from '@/lib/oauth/state'

// TikTok's v2 authorization endpoint requires PKCE (code_challenge /
// code_verifier) — the code_verifier is kept secret in an httpOnly cookie
// rather than the `state` param, since `state` round-trips through the
// browser and PKCE's security only holds if the verifier never does.

const PKCE_COOKIE = 'tiktok_pkce_verifier'

function generatePkcePair() {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export async function GET(_req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const membership = await prisma.workspaceMember.findFirst({ where: { userId: user.id } })
    if (!membership) {
      return NextResponse.redirect(new URL('/app/settings', _req.url))
    }

    const tkClientKey = process.env.TIKTOK_CLIENT_KEY
    const tkRedirectUri =
      process.env.TIKTOK_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL}/api/social/tiktok/callback`

    if (!tkClientKey) {
      return NextResponse.redirect(
        new URL('/app/social-accounts?error=tiktok_api_not_configured', _req.url)
      )
    }

    const scopes = ['user.info.basic', 'video.upload']
    if (process.env.TIKTOK_DIRECT_POST_ENABLED === 'true') scopes.push('video.publish')
    const scope = scopes.join(',')
    const state = createOAuthState({
      workspaceId: membership.workspaceId,
      userId: user.id,
      provider: 'tiktok',
    })
    const { codeVerifier, codeChallenge } = generatePkcePair()

    const authorizeUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${tkClientKey}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(tkRedirectUri)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`

    const res = NextResponse.redirect(authorizeUrl)
    res.cookies.set(PKCE_COOKIE, codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
    return res
  } catch (err) {
    return apiServerError(err)
  }
}
