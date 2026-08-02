import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
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

interface Params {
  params: Promise<{ id: string }>
}

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  mediaTrashRetentionDays: z.union([z.literal(7), z.literal(30)]).optional(),
}).refine(
  (data) => data.name !== undefined || data.mediaTrashRetentionDays !== undefined,
  { message: 'At least one workspace setting is required' }
)

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()
    const workspace = await prisma.workspace.findUnique({ where: { id } })
    if (!workspace) return apiNotFound('Workspace')
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'manage_workspace')) {
      return apiError('Insufficient permissions to edit this workspace', 403)
    }
    const parsed = updateWorkspaceSchema.safeParse(await request.json())
    if (!parsed.success) return apiError('Workspace settings are invalid')

    const updated = await prisma.$transaction(async (transaction) => {
      const nextWorkspace = await transaction.workspace.update({
        where: { id },
        data: parsed.data,
        select: {
          id: true,
          name: true,
          slug: true,
          mediaTrashRetentionDays: true,
        },
      })

      if (parsed.data.mediaTrashRetentionDays !== undefined) {
        const trashedAssets = await transaction.mediaAsset.findMany({
          where: { workspaceId: id, deletedAt: { not: null } },
          select: { id: true, deletedAt: true },
        })
        for (const asset of trashedAssets) {
          if (!asset.deletedAt) continue
          await transaction.mediaAsset.update({
            where: { id: asset.id },
            data: {
              purgeAfter: new Date(
                asset.deletedAt.getTime() + parsed.data.mediaTrashRetentionDays * 24 * 60 * 60 * 1000
              ),
            },
          })
        }
      }

      return nextWorkspace
    })
    return apiSuccess(updated)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
