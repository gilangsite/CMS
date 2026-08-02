import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ApprovalStatus, PublishingStatus } from '@prisma/client'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { logActivity } from '@/lib/activity-log'
import { createContentInputSchema } from '@/lib/content/schemas'
import { validateContentReferences } from '@/lib/content/validate-references'

function enumValue<T extends string>(value: string | null, values: T[]): T | undefined {
  return value && values.includes(value as T) ? value as T : undefined
}

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const requestedWorkspaceId = req.nextUrl.searchParams.get('workspaceId')
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        ...(requestedWorkspaceId ? { workspaceId: requestedWorkspaceId } : {}),
      },
    })
    if (!membership) return apiError('No workspace found', 404)

    const { searchParams } = req.nextUrl
    const brandId = searchParams.get('brandId')
    const campaignId = searchParams.get('campaignId')
    const approvalStatus = enumValue(
      searchParams.get('approvalStatus')?.toUpperCase() ?? null,
      Object.values(ApprovalStatus)
    )
    const publishingStatus = enumValue(
      searchParams.get('publishingStatus')?.toUpperCase() ?? null,
      Object.values(PublishingStatus)
    )

    const items = await prisma.contentItem.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...(brandId ? { brandId } : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(approvalStatus ? { approvalStatus } : {}),
        ...(publishingStatus ? { publishingStatus } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        brand: true,
        campaign: true,
        creator: { select: { id: true, name: true, avatarUrl: true } },
        contentAssets: {
          include: { mediaAsset: true },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
        platformPosts: {
          include: {
            socialAccount: {
              select: { platform: true, username: true, displayName: true },
            },
          },
        },
      },
    })

    return apiSuccess(items)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const parsed = createContentInputSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(
        'Invalid content data',
        400,
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      )
    }
    const input = parsed.data

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, workspaceId: input.workspaceId },
    })
    if (!membership) return apiError('Not a member of this workspace', 403)

    const referenceError = await validateContentReferences(input.workspaceId, input)
    if (referenceError) return apiError(referenceError)

    const mediaIds = [...new Set(input.mediaIds)]
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null
    const posts = (input.platformPosts ?? []).filter((post) => post.socialAccountId)

    const contentItem = await prisma.contentItem.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId || null,
        campaignId: input.campaignId || null,
        title: input.title || null,
        internalNotes: input.internalNotes || null,
        createdBy: user.id,
        approvalStatus: input.submitForReview ? 'IN_REVIEW' : 'DRAFT',
        publishingStatus: input.submitForReview ? 'PENDING_APPROVAL' : 'DRAFT',
        scheduledAt,
        contentAssets: mediaIds.length
          ? {
              create: mediaIds.map((mediaAssetId, index) => ({
                mediaAssetId,
                sortOrder: index,
                role: index === 0 ? 'primary' : 'additional',
              })),
            }
          : undefined,
        platformPosts: posts.length
          ? {
              create: posts.map((post) => ({
                socialAccountId: post.socialAccountId as string,
                platform: post.platform,
                destination: post.destination,
                caption: post.caption || null,
                hashtags: post.hashtags,
                mentions: post.mentions,
                collaborators: post.collaborators,
                musicPlan: post.musicPlan || null,
                postMode: post.postMode,
                privacyLevel: post.privacyLevel || null,
                allowComments: post.allowComments ?? null,
                allowDuet: post.allowDuet ?? null,
                allowStitch: post.allowStitch ?? null,
                commercialDisclosureEnabled: post.commercialDisclosureEnabled ?? false,
                commercialDisclosureType: post.commercialDisclosureType || null,
                musicUsageConfirmed: post.musicUsageConfirmed ?? false,
                userConsentConfirmed: post.userConsentConfirmed ?? false,
                coverTimestampMs: post.coverTimestampMs ?? null,
                scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : scheduledAt,
                status: 'DRAFT',
              })),
            }
          : undefined,
      },
      include: {
        contentAssets: { include: { mediaAsset: true } },
        platformPosts: true,
      },
    })

    await logActivity({
      workspaceId: input.workspaceId,
      actorId: user.id,
      entityType: 'content_item',
      entityId: contentItem.id,
      action: input.submitForReview ? 'content.submitted_review' : 'content.created',
      metadata: { title: input.title, platforms: posts.map((post) => post.platform) },
    })

    return apiSuccess(contentItem, 201)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
