import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import {
  pollPlatformPostStatus,
  processPlatformPost,
} from '@/lib/publishing/process-platform-post'

export const maxDuration = 300

const STALE_SCHEDULE_MS = 24 * 60 * 60 * 1000
const STUCK_PROCESSING_MS = 20 * 60 * 1000

function authorizeCron(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (process.env.NODE_ENV !== 'production') return null
  if (!cronSecret) {
    console.error('[Cron/Publishing] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Runs every minute (vercel.json). Due posts are processed in this request,
 * rather than merely forwarded to an external worker that may not be
 * registered. Old schedules are failed safely instead of publishing stale
 * content days or months later.
 */
export async function GET(req: NextRequest) {
  const authError = authorizeCron(req)
  if (authError) return authError

  try {
    const now = new Date()
    const staleCutoff = new Date(now.getTime() - STALE_SCHEDULE_MS)
    const stuckCutoff = new Date(now.getTime() - STUCK_PROCESSING_MS)

    const stalePosts = await prisma.platformPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lt: staleCutoff },
      },
      select: { id: true, contentItemId: true },
      take: 100,
    })
    if (stalePosts.length > 0) {
      await prisma.platformPost.updateMany({
        where: { id: { in: stalePosts.map((post) => post.id) } },
        data: {
          status: 'FAILED',
          errorCode: 'schedule_missed',
          errorMessage: 'The scheduled time was missed by more than 24 hours. Review and retry manually.',
        },
      })
      await prisma.contentItem.updateMany({
        where: { id: { in: [...new Set(stalePosts.map((post) => post.contentItemId))] } },
        data: { publishingStatus: 'FAILED' },
      })
    }

    const stuckPosts = await prisma.platformPost.findMany({
      where: {
        status: 'POSTING',
        lastAttemptAt: { lt: stuckCutoff },
      },
      select: { id: true, contentItemId: true },
      take: 100,
    })
    if (stuckPosts.length > 0) {
      await prisma.platformPost.updateMany({
        where: { id: { in: stuckPosts.map((post) => post.id) } },
        data: {
          status: 'FAILED',
          errorCode: 'worker_timeout',
          errorMessage: 'The publishing worker timed out. Review the post and retry.',
        },
      })
      await prisma.contentItem.updateMany({
        where: { id: { in: [...new Set(stuckPosts.map((post) => post.contentItemId))] } },
        data: { publishingStatus: 'FAILED' },
      })
    }

    const [duePosts, processingPosts] = await Promise.all([
      prisma.platformPost.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { gte: staleCutoff, lte: now },
          contentItem: { approvalStatus: 'APPROVED' },
        },
        select: { id: true, contentItem: { select: { workspaceId: true } } },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
      prisma.platformPost.findMany({
        where: { status: 'PROCESSING' },
        select: { id: true },
        orderBy: { updatedAt: 'asc' },
        take: 20,
      }),
    ])

    const publishResults = []
    for (const post of duePosts) {
      publishResults.push(await processPlatformPost(post.id, post.contentItem.workspaceId))
    }

    const pollResults = []
    for (const post of processingPosts) {
      pollResults.push(await pollPlatformPostStatus(post.id))
    }

    return NextResponse.json({
      due: duePosts.length,
      published: publishResults.filter((result) => result.status === 'POSTED').length,
      processing: publishResults.filter((result) => result.status === 'PROCESSING').length,
      failed: publishResults.filter((result) => result.status === 'FAILED').length,
      polled: pollResults.length,
      staleFailed: stalePosts.length,
      timedOut: stuckPosts.length,
      timestamp: now.toISOString(),
    })
  } catch (error: unknown) {
    console.error('[Cron/Publishing]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
