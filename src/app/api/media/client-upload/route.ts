import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/workspace'
import { apiError, apiServerError, apiUnauthorized } from '@/lib/api-response'

const MAX_SIZE = 500 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]

export async function POST(req: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return apiError('Vercel Blob is not configured', 503)
    }

    const body = await req.json() as HandleUploadBody
    if (body.type === 'blob.generate-client-token') {
      const { userId: clerkId } = await auth()
      if (!clerkId) return apiUnauthorized()
      const user = await getCurrentUser()
      if (!user) return apiUnauthorized()

      const workspaceId = body.payload.clientPayload
      if (!workspaceId) return apiError('workspaceId is required')
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId: user.id },
        select: { id: true },
      })
      if (!membership) return apiError('Not a member of this workspace', 403)
    }

    const response = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) throw new Error('workspaceId is required')
        const safeWorkspaceId = clientPayload.replace(/[^a-zA-Z0-9-_]/g, '')
        if (safeWorkspaceId !== clientPayload || !pathname.startsWith(`cms/${safeWorkspaceId}/`)) {
          throw new Error('Invalid upload path')
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ workspaceId: safeWorkspaceId }),
        }
      },
    })

    return NextResponse.json(response)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
