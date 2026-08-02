import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { logActivity } from '@/lib/activity-log'
import { syncContentPublishingStatus } from '@/lib/publishing/process-platform-post'

type TikTokWebhook = {
  client_key?: string
  event?: string
  create_time?: number
  user_openid?: string
  content?: string | {
    publish_id?: string
    reason?: string
    publish_type?: string
  }
}

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) return false
  const values = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key, value.join('=')]
    })
  )
  const timestamp = Number(values.t)
  const signature = values.s
  if (!Number.isFinite(timestamp) || !signature) return false
  if (Math.abs(Date.now() / 1000 - timestamp) > 5 * 60) return false
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest()
  const received = Buffer.from(signature, 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.TIKTOK_CLIENT_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 })
    }
    const rawBody = await request.text()
    if (!verifySignature(rawBody, request.headers.get('tiktok-signature'), secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const body = JSON.parse(rawBody) as TikTokWebhook
    if (body.client_key && body.client_key !== process.env.TIKTOK_CLIENT_KEY) {
      return NextResponse.json({ error: 'Invalid client key' }, { status: 401 })
    }
    const content =
      typeof body.content === 'string'
        ? JSON.parse(body.content) as {
            publish_id?: string
            reason?: string
            publish_type?: string
          }
        : body.content ?? {}

    if (body.event === 'authorization.removed' && body.user_openid) {
      await prisma.socialAccount.updateMany({
        where: { platform: 'TIKTOK', platformAccountId: body.user_openid },
        data: { status: 'DISCONNECTED' },
      })
      return NextResponse.json({ received: true })
    }

    if (content.publish_id) {
      const post = await prisma.platformPost.findFirst({
        where: { platform: 'TIKTOK', platformMediaId: content.publish_id },
        include: { contentItem: { select: { workspaceId: true } } },
      })
      if (post) {
        if (body.event === 'post.publish.complete') {
          await prisma.platformPost.update({
            where: { id: post.id },
            data: {
              status: 'POSTED',
              publishedAt: post.publishedAt ?? new Date(),
              errorCode: null,
              errorMessage: null,
            },
          })
          await logActivity({
            workspaceId: post.contentItem.workspaceId,
            entityType: 'platform_post',
            entityId: post.id,
            action: 'publishing.succeeded',
            metadata: { platform: 'TIKTOK', source: 'webhook' },
          })
        } else if (body.event === 'post.publish.inbox_delivered') {
          await prisma.platformPost.update({
            where: { id: post.id },
            data: { status: 'NEEDS_MANUAL_FINALIZATION', errorCode: null, errorMessage: null },
          })
        } else if (body.event === 'post.publish.failed') {
          await prisma.platformPost.update({
            where: { id: post.id },
            data: {
              status: 'FAILED',
              errorCode: 'tiktok_webhook_failed',
              errorMessage: content.reason ?? 'TikTok reported a publishing failure.',
            },
          })
        }
        await syncContentPublishingStatus(post.contentItemId)
      }
    }
    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error('[Webhook/TikTok]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
