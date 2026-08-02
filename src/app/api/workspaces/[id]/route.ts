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
  name: z.string().trim().min(1).max(120),
})

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
    if (!parsed.success) return apiError('Workspace name is invalid')

    const updated = await prisma.workspace.update({
      where: { id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, slug: true },
    })
    return apiSuccess(updated)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
