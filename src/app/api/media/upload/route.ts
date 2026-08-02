import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { logActivity } from '@/lib/activity-log'
import path from 'path'
import fs from 'fs/promises'

export const maxDuration = 60

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
]
const MAX_SIZE = 500 * 1024 * 1024 // 500MB

/**
 * Upload a file to Vercel Blob (production) or local /public/uploads (dev fallback).
 * Uses local storage when BLOB_READ_WRITE_TOKEN is not set, so the app works
 * fully offline/in localhost without needing a Vercel Blob account.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const workspaceId = formData.get('workspaceId') as string | null

    if (!file)        return apiError('No file provided')
    if (!workspaceId) return apiError('workspaceId is required')

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId: user.id } })
    if (!member) return apiError('Not a member of this workspace', 403)

    if (file.size > MAX_SIZE)               return apiError('File size exceeds 500MB limit')
    if (!ALLOWED_TYPES.includes(file.type)) return apiError(`Unsupported file type: ${file.type}`)

    let fileUrl: string
    let storageProvider: string

    const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN
    if (
      !hasBlobToken &&
      (process.env.NODE_ENV === 'production' ||
        process.env.NEXT_PUBLIC_MOCK_PUBLISHING !== 'true')
    ) {
      return apiError(
        'Public media storage is not configured. Add BLOB_READ_WRITE_TOKEN to .env.local and restart npm run dev.',
        503
      )
    }

    if (hasBlobToken) {
      // ── Production: Vercel Blob ──────────────────────────────────────────────
      const { put } = await import('@vercel/blob')
      const blob = await put(`cms/${workspaceId}/${Date.now()}-${file.name}`, file, {
        access: 'public',
        contentType: file.type,
      })
      fileUrl         = blob.url
      storageProvider = 'vercel_blob'
    } else {
      // ── Development: Local file storage fallback ─────────────────────────────
      console.info('[upload] BLOB_READ_WRITE_TOKEN not set — using local storage fallback')

      const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9-_]/g, '')
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', safeWorkspaceId)
      await fs.mkdir(uploadDir, { recursive: true })

      const ext       = path.extname(file.name) || ''
      const safeBase  = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64)
      const fileName  = `${Date.now()}-${safeBase}${ext}`
      const filePath  = path.join(uploadDir, fileName)

      const arrayBuffer = await file.arrayBuffer()
      await fs.writeFile(filePath, Buffer.from(arrayBuffer))

      fileUrl         = `/uploads/${safeWorkspaceId}/${fileName}`
      storageProvider = 'local'
    }

    // Save metadata to DB
    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId,
        uploadedBy:      user.id,
        fileUrl,
        fileName:        file.name,
        mimeType:        file.type,
        fileSize:        BigInt(file.size),
        storageProvider,
      },
    })

    await logActivity({
      workspaceId,
      actorId:    user.id,
      entityType: 'media_asset',
      entityId:   asset.id,
      action:     'media.uploaded',
      metadata: {
        fileName:        file.name,
        mimeType:        file.type,
        fileSize:        file.size,
        storageProvider,
      },
    })

    return apiSuccess({ ...asset, fileSize: asset.fileSize?.toString() }, 201)
  } catch (err) {
    return apiServerError(err)
  }
}
