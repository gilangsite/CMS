import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import {
  apiError,
  apiServerError,
  apiSuccess,
  apiUnauthorized,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'

function numericMetric(metrics: Prisma.JsonValue | null, keys: string[]): number {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return 0
  const record = metrics as Record<string, Prisma.JsonValue>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return 0
}

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    const requestedDays = Number(request.nextUrl.searchParams.get('days') ?? 7)
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 7
    if (!workspaceId) return apiError('workspaceId is required')
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
      select: { id: true },
    })
    if (!member) return apiError('Not a member of this workspace', 403)

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const posts = await prisma.platformPost.findMany({
      where: {
        contentItem: { workspaceId },
        status: 'POSTED',
        publishedAt: { gte: since },
      },
      include: {
        analyticsSnapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
        contentItem: {
          select: {
            id: true,
            title: true,
            contentAssets: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: {
                mediaAsset: {
                  select: { fileUrl: true, thumbnailUrl: true, mimeType: true },
                },
              },
            },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 250,
    })

    const normalized = posts.map((post) => {
      const metrics = post.analyticsSnapshots[0]?.metrics ?? null
      const likes = numericMetric(metrics, ['likes', 'like_count'])
      const comments = numericMetric(metrics, ['comments', 'comments_count'])
      const shares = numericMetric(metrics, ['shares'])
      const saved = numericMetric(metrics, ['saved', 'saves'])
      const reach = numericMetric(metrics, ['reach', 'views', 'impressions'])
      const interactions =
        numericMetric(metrics, ['total_interactions', 'engagement']) ||
        likes + comments + shares + saved
      return {
        id: post.id,
        contentItemId: post.contentItem.id,
        title: post.contentItem.title,
        platform: post.platform,
        destination: post.destination,
        publishedAt: post.publishedAt,
        platformPostUrl: post.platformPostUrl,
        media: post.contentItem.contentAssets[0]?.mediaAsset ?? null,
        metrics: { reach, interactions, likes, comments, shares, saved },
        capturedAt: post.analyticsSnapshots[0]?.capturedAt ?? null,
      }
    })

    const totals = normalized.reduce(
      (result, post) => ({
        reach: result.reach + post.metrics.reach,
        interactions: result.interactions + post.metrics.interactions,
        likes: result.likes + post.metrics.likes,
        comments: result.comments + post.metrics.comments,
        shares: result.shares + post.metrics.shares,
        saved: result.saved + post.metrics.saved,
      }),
      { reach: 0, interactions: 0, likes: 0, comments: 0, shares: 0, saved: 0 }
    )

    return apiSuccess({
      days,
      postedCount: normalized.length,
      snapshotCount: normalized.filter((post) => post.capturedAt).length,
      totals,
      posts: normalized,
    })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
