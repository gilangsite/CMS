import prisma from '@/lib/db/prisma'
import { apiSuccess, apiUnauthorized, apiForbidden, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Props) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const { id: workspaceId } = await params

    const requesterMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    })
    if (!requesterMembership) return apiForbidden()

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    })

    return apiSuccess(members)
  } catch (err) {
    return apiServerError(err)
  }
}
