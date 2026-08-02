import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { head } from '@vercel/blob'
import prisma from '@/lib/db/prisma'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiServerError,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { logActivity } from '@/lib/activity-log'

const MAX_SIZE = 500 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()
    if (!process.env.BLOB_READ_WRITE_TOKEN) return apiError('Vercel Blob is not configured', 503)

    const body = await req.json() as {
      workspaceId?: unknown
      fileUrl?: unknown
      fileName?: unknown
      width?: unknown
      height?: unknown
      durationSeconds?: unknown
    }
    if (typeof body.workspaceId !== 'string' || typeof body.fileUrl !== 'string') {
      return apiError('workspaceId and fileUrl are required')
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: body.workspaceId, userId: user.id },
      select: { id: true },
    })
    if (!membership) return apiError('Not a member of this workspace', 403)

    const blob = await head(body.fileUrl)
    if (!blob.pathname.startsWith(`cms/${body.workspaceId}/`)) {
      return apiError('Uploaded file does not belong to this workspace', 403)
    }
    if (!ALLOWED_TYPES.has(blob.contentType)) {
      return apiError(`Unsupported file type: ${blob.contentType}`)
    }
    if (blob.size > MAX_SIZE) return apiError('File size exceeds 500MB limit')

    const existing = await prisma.mediaAsset.findFirst({
      where: { workspaceId: body.workspaceId, fileUrl: blob.url },
    })
    if (existing) return apiSuccess(existing)

    const width = typeof body.width === 'number' && Number.isInteger(body.width) ? body.width : null
    const height = typeof body.height === 'number' && Number.isInteger(body.height) ? body.height : null
    const durationSeconds =
      typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
        ? body.durationSeconds
        : null
    const fileName =
      typeof body.fileName === 'string' && body.fileName.trim()
        ? body.fileName.trim().slice(0, 255)
        : blob.pathname.split('/').at(-1) ?? null

    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId: body.workspaceId,
        uploadedBy: user.id,
        fileUrl: blob.url,
        fileName,
        mimeType: blob.contentType,
        fileSize: BigInt(blob.size),
        width,
        height,
        durationSeconds,
        storageProvider: 'vercel_blob',
      },
    })

    await logActivity({
      workspaceId: body.workspaceId,
      actorId: user.id,
      entityType: 'media_asset',
      entityId: asset.id,
      action: 'media.uploaded',
      metadata: {
        fileName,
        mimeType: blob.contentType,
        fileSize: blob.size,
        storageProvider: 'vercel_blob_client',
      },
    })

    return apiSuccess({ ...asset, fileSize: asset.fileSize?.toString() }, 201)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
