import { auth } from '@clerk/nextjs/server'
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
import { deleteMediaStorage } from '@/lib/media/delete-storage'

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
        workspace: { select: { mediaTrashRetentionDays: true } },
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

    const permanent = new URL(_request.url).searchParams.get('permanent') === 'true'
    if (permanent) {
      if (!asset.deletedAt) {
        return apiError('Move this file to Trash before deleting it permanently.', 409)
      }
      await deleteMediaStorage(asset)
      await prisma.mediaAsset.delete({ where: { id } })

      await logActivity({
        workspaceId: asset.workspaceId,
        actorId: user.id,
        entityType: 'media_asset',
        entityId: id,
        action: 'media.deleted',
        metadata: { fileName: asset.fileName, permanent: true },
      })
      return apiSuccess({ deleted: true, permanent: true })
    }

    if (asset.deletedAt) {
      return apiSuccess({ deleted: true, purgeAfter: asset.purgeAfter })
    }

    const deletedAt = new Date()
    const purgeAfter = new Date(
      deletedAt.getTime() + asset.workspace.mediaTrashRetentionDays * 24 * 60 * 60 * 1000
    )
    await prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt, purgeAfter, deletedBy: user.id },
    })

    await logActivity({
      workspaceId: asset.workspaceId,
      actorId: user.id,
      entityType: 'media_asset',
      entityId: id,
      action: 'media.trashed',
      metadata: {
        fileName: asset.fileName,
        retentionDays: asset.workspace.mediaTrashRetentionDays,
        purgeAfter: purgeAfter.toISOString(),
      },
    })
    return apiSuccess({ deleted: true, permanent: false, purgeAfter })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const asset = await prisma.mediaAsset.findUnique({ where: { id } })
    if (!asset) return apiNotFound('Media asset')

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: asset.workspaceId, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)
    const ownsAsset = asset.uploadedBy === user.id
    if (!hasPermission(member.role, 'delete') && !(ownsAsset && hasPermission(member.role, 'delete_own'))) {
      return apiError('Insufficient permissions to restore this media', 403)
    }
    if (!asset.deletedAt) return apiSuccess(asset)

    const restored = await prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: null, purgeAfter: null, deletedBy: null },
    })
    await logActivity({
      workspaceId: asset.workspaceId,
      actorId: user.id,
      entityType: 'media_asset',
      entityId: id,
      action: 'media.restored',
      metadata: { fileName: asset.fileName },
    })
    return apiSuccess(restored)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
