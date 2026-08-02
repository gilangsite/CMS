import { auth } from '@clerk/nextjs/server'
import { del } from '@vercel/blob'
import fs from 'fs/promises'
import path from 'path'
import prisma from '@/lib/db/prisma'
import {
  apiError,
  apiNotFound,
  apiServerError,
  apiSuccess,
  apiUnauthorized,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity-log'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        _count: { select: { contentAssets: true, coverForPosts: true } },
      },
    })
    if (!asset) return apiNotFound('Media asset')

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: asset.workspaceId, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)
    const ownsAsset = asset.uploadedBy === user.id
    if (!hasPermission(member.role, 'delete') && !(ownsAsset && hasPermission(member.role, 'delete_own'))) {
      return apiError('Insufficient permissions to delete this media', 403)
    }
    if (asset._count.contentAssets > 0 || asset._count.coverForPosts > 0) {
      return apiError('This file is used by content. Remove it from the content before deleting it.', 409)
    }

    await prisma.mediaAsset.delete({ where: { id } })

    try {
      if (asset.storageProvider === 'vercel_blob' && asset.fileUrl.startsWith('https://')) {
        await del(asset.fileUrl)
      } else if (asset.storageProvider === 'local' && asset.fileUrl.startsWith('/uploads/')) {
        const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
        const filePath = path.resolve(process.cwd(), 'public', asset.fileUrl.slice(1))
        if (filePath.startsWith(`${uploadsRoot}${path.sep}`)) await fs.unlink(filePath)
      }
    } catch (storageError) {
      console.error('[media.delete] Storage cleanup failed after database delete', storageError)
    }

    await logActivity({
      workspaceId: asset.workspaceId,
      actorId: user.id,
      entityType: 'media_asset',
      entityId: id,
      action: 'media.deleted',
      metadata: { fileName: asset.fileName },
    })
    return apiSuccess({ deleted: true })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
