import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getMissingProductionEnvironment } from '@/lib/env/production-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const missingEnvironment = getMissingProductionEnvironment()
  if (missingEnvironment.length > 0) {
    return NextResponse.json(
      {
        status: 'configuration_required',
        missingEnvironment,
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }

  try {
    // Selecting the newest required field verifies both connectivity and that
    // production migrations have been applied, even when there are no rows.
    await prisma.workspace.findFirst({
      select: { id: true, mediaTrashRetentionDays: true },
    })
    return NextResponse.json(
      { status: 'ready', database: 'connected' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: unknown) {
    console.error('[Health] Database connection failed', error)
    return NextResponse.json(
      { status: 'database_unavailable' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }
}
