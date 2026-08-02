import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { logActivity } from '@/lib/activity-log'
import { syncContentPublishingStatus } from '@/lib/publishing/process-platform-post'

type MetaWebhook = {
  object?: string
  entry?: {
    changes?: {
      field?: string
      value?: {
        media_id?: string
        status?: string
        error_message?: string
      }
    }[]
  }[]
}

function validSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false
  const received = Buffer.from(header.slice('sha256='.length), 'hex')
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN

  if (verifyToken && mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.META_APP_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
    }
    const rawBody = await request.text()
    if (!validSignature(rawBody, request.headers.get('x-hub-signature-256'), secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const body = JSON.parse(rawBody) as MetaWebhook

    if (body.object === 'instagram') {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== 'content_publishing_events') continue
          const mediaId = change.value?.media_id
          const status = change.value?.status
          if (!mediaId || !status) continue

          const post = await prisma.platformPost.findFirst({
            where: { platformMediaId: mediaId },
            include: { contentItem: { select: { workspaceId: true } } },
          })
          if (!post) continue

          if (status === 'COMPLETED') {
            await prisma.platformPost.update({
              where: { id: post.id },
              data: {
                status: 'POSTED',
                publishedAt: post.publishedAt ?? new Date(),
                errorCode: null,
                errorMessage: null,
              },
            })
            await syncContentPublishingStatus(post.contentItemId)
            await logActivity({
              workspaceId: post.contentItem.workspaceId,
              entityType: 'platform_post',
              entityId: post.id,
              action: 'publishing.succeeded',
              metadata: { platform: 'INSTAGRAM', mediaId, source: 'webhook' },
            })
          } else if (status === 'ERROR' || status === 'FAILED') {
            await prisma.platformPost.update({
              where: { id: post.id },
              data: {
                status: 'FAILED',
                errorCode: 'instagram_webhook_failed',
                errorMessage: change.value?.error_message ?? 'Instagram reported a publishing failure.',
              },
            })
            await syncContentPublishingStatus(post.contentItemId)
          }
        }
      }
    }
    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error('[Webhook/Meta]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
