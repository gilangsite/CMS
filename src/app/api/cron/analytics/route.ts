import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getValidAccessToken } from '@/lib/platforms/access-token'

export const maxDuration = 300

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v25.0'

type InstagramMediaMetrics = {
  like_count?: number
  comments_count?: number
  permalink?: string
  error?: { message?: string; code?: number }
}

function authorizeCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (process.env.NODE_ENV !== 'production') return null
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const authError = authorizeCron(request)
  if (authError) return authError
  try {
    const posts = await prisma.platformPost.findMany({
      where: {
        platform: 'INSTAGRAM',
        status: 'POSTED',
        publishedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        platformMediaId: { not: null },
      },
      include: { socialAccount: true },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    })

    let captured = 0
    const errors: string[] = []
    for (const post of posts) {
      if (!post.platformMediaId) continue
      const token = await getValidAccessToken(post.socialAccount)
      if (!token.success || !token.accessToken) {
        errors.push(`${post.id}: ${token.errorMessage ?? 'token unavailable'}`)
        continue
      }
      try {
        const response = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${post.platformMediaId}?fields=like_count,comments_count,permalink`,
          { headers: { Authorization: `Bearer ${token.accessToken}` } }
        )
        const data = await response.json() as InstagramMediaMetrics
        if (!response.ok || data.error) {
          errors.push(`${post.id}: ${data.error?.message ?? `HTTP ${response.status}`}`)
          continue
        }
        const likes = data.like_count ?? 0
        const comments = data.comments_count ?? 0
        await prisma.$transaction([
          prisma.analyticsSnapshot.create({
            data: {
              platformPostId: post.id,
              platform: 'INSTAGRAM',
              metrics: {
                likes,
                comments,
                total_interactions: likes + comments,
              },
            },
          }),
          ...(data.permalink && !post.platformPostUrl
            ? [
                prisma.platformPost.update({
                  where: { id: post.id },
                  data: { platformPostUrl: data.permalink },
                }),
              ]
            : []),
        ])
        captured++
      } catch (error: unknown) {
        errors.push(`${post.id}: ${error instanceof Error ? error.message : 'request failed'}`)
      }
    }

    return NextResponse.json({
      postsFound: posts.length,
      captured,
      errors: errors.slice(0, 20),
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    console.error('[Cron/Analytics]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
