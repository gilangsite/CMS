import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import {
  apiError,
  apiServerError,
  apiSuccess,
  apiUnauthorized,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { hasPermission } from '@/lib/auth/permissions'

const campaignInput = z.object({
  workspaceId: z.string().trim().min(1),
  brandId: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(160),
  objective: z.string().trim().max(2_000).nullable().optional(),
  startDate: z.string().datetime({ offset: true }).nullable().optional(),
  endDate: z.string().datetime({ offset: true }).nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId) return apiError('workspaceId is required')
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)

    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        brand: { select: { id: true, name: true } },
        contentItems: { select: { publishingStatus: true } },
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    })
    return apiSuccess(campaigns)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()
    const parsed = campaignInput.safeParse(await request.json())
    if (!parsed.success) return apiError('Invalid campaign data', 400)
    const input = parsed.data

    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: input.workspaceId, userId: user.id },
    })
    if (!member) return apiError('Not a member of this workspace', 403)
    if (!hasPermission(member.role, 'create')) {
      return apiError('Insufficient permissions to create campaigns', 403)
    }
    if (input.brandId) {
      const brand = await prisma.brand.findFirst({
        where: { id: input.brandId, workspaceId: input.workspaceId },
        select: { id: true },
      })
      if (!brand) return apiError('The selected brand does not belong to this workspace')
    }
    const startDate = input.startDate ? new Date(input.startDate) : null
    const endDate = input.endDate ? new Date(input.endDate) : null
    if (startDate && endDate && endDate < startDate) {
      return apiError('Campaign end date must be after its start date')
    }

    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId || null,
        name: input.name,
        objective: input.objective || null,
        startDate,
        endDate,
      },
      include: { brand: { select: { id: true, name: true } } },
    })
    return apiSuccess(campaign, 201)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
