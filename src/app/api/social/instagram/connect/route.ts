import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { createOAuthState } from '@/lib/oauth/state'

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v25.0'

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const membership = await prisma.workspaceMember.findFirst({ where: { userId: user.id } })
    if (!membership) return NextResponse.redirect(new URL('/app/settings', req.url))

    const metaAppId = process.env.META_APP_ID
    const metaRedirectUri =
      process.env.META_REDIRECT_URI ??
      new URL('/api/social/instagram/callback', req.nextUrl.origin).toString()

    if (!metaAppId) {
      return NextResponse.redirect(
        new URL('/app/social-accounts?error=instagram_api_not_configured', req.url)
      )
    }

    const metaConfigId = process.env.META_CONFIG_ID
    const scope = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
    ].join(',')
    const state = createOAuthState({
      workspaceId: membership.workspaceId,
      userId: user.id,
      provider: 'instagram',
    })
    const params = new URLSearchParams({
      client_id: metaAppId,
      redirect_uri: metaRedirectUri,
      state,
      response_type: 'code',
      auth_type: 'rerequest',
    })
    if (metaConfigId) {
      params.set('config_id', metaConfigId)
      params.set('override_default_response_type', 'true')
    } else {
      params.set('scope', scope)
    }

    return NextResponse.redirect(
      `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`
    )
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
