import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { logActivity } from '@/lib/activity-log'
import { hasPermission } from '@/lib/auth/permissions'

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) return apiError('workspaceId is required')

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId: user.id } })
    if (!member) return apiError('Not a member of this workspace', 403)
    const brands = await prisma.brand.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    })
    return apiSuccess(brands)
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

    const body = await req.json()
    const { workspaceId, name, description } = body
    if (!workspaceId || !name?.trim()) return apiError('workspaceId and name are required')

    const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId: user.id } })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'manage_brands')) {
      return apiError('Insufficient permissions to create brands', 403)
    }

    const brand = await prisma.brand.create({
      data: { workspaceId, name: name.trim(), description: description ?? null },
    })

    await logActivity({ workspaceId, actorId: user.id, entityType: 'brand', entityId: brand.id, action: 'brand.created', metadata: { name } })
    return apiSuccess(brand, 201)
  } catch (err) {
    return apiServerError(err)
  }
}
