import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { logActivity } from '@/lib/activity-log'

export async function GET() {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: user.id } } },
      include: { members: { where: { userId: user.id }, take: 1 } },
    })
    return apiSuccess(workspaces)
  } catch (err) {
    return apiServerError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    // Handle both JSON API calls and native HTML form submissions
    const contentType = req.headers.get('content-type') ?? ''
    let name: string
    if (contentType.includes('application/json')) {
      const body = await req.json()
      name = body.name
    } else {
      const formData = await req.formData()
      name = formData.get('name') as string
    }
    if (!name?.trim()) return apiError('Workspace name is required')

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()

    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        slug,
        createdBy: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
      include: { members: true },
    })

    await logActivity({ workspaceId: workspace.id, actorId: user.id, entityType: 'workspace', entityId: workspace.id, action: 'workspace.created' })
    return apiSuccess(workspace, 201)
  } catch (err) {
    return apiServerError(err)
  }
}
