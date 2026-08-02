import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { deleteMediaStorage } from '@/lib/media/delete-storage'
import { logActivity } from '@/lib/activity-log'

export const maxDuration = 60

function authorizeCron(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[Cron/MediaCleanup] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const authError = authorizeCron(request)
  if (authError) return authError

  const now = new Date()
  try {
    const expiredAssets = await prisma.mediaAsset.findMany({
      where: {
        deletedAt: { not: null },
        purgeAfter: { lte: now },
        contentAssets: { none: {} },
        coverForPosts: { none: {} },
      },
      orderBy: { purgeAfter: 'asc' },
      take: 100,
    })

    const failures: Array<{ id: string; error: string }> = []
    let deleted = 0

    for (const asset of expiredAssets) {
      try {
        await deleteMediaStorage(asset)
        await prisma.mediaAsset.delete({ where: { id: asset.id } })
        deleted++
        await logActivity({
          workspaceId: asset.workspaceId,
          entityType: 'media_asset',
          entityId: asset.id,
          action: 'media.purged',
          metadata: { fileName: asset.fileName, automatic: true },
        })
      } catch (error: unknown) {
        failures.push({
          id: asset.id,
          error: error instanceof Error ? error.message : 'Cleanup failed',
        })
        console.error(`[Cron/MediaCleanup] Failed to purge ${asset.id}`, error)
      }
    }

    return NextResponse.json({
      checked: expiredAssets.length,
      deleted,
      failed: failures.length,
      failures: failures.slice(0, 20),
      timestamp: now.toISOString(),
    })
  } catch (error: unknown) {
    console.error('[Cron/MediaCleanup]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
