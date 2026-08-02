import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiNotFound,
  apiServerError,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'
import { hasPermission } from '@/lib/auth/permissions'
import { logActivity } from '@/lib/activity-log'
import { updateContentInputSchema } from '@/lib/content/schemas'
import { validateContentReferences } from '@/lib/content/validate-references'

interface Params {
  params: Promise<{ id: string }>
}

async function getContentItem(id: string, userId: string) {
  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: {
      brand: true,
      campaign: true,
      creator: { select: { id: true, name: true, avatarUrl: true } },
      approvalComments: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
      contentAssets: { include: { mediaAsset: true }, orderBy: { sortOrder: 'asc' } },
      platformPosts: {
        include: {
          socialAccount: {
            select: {
              id: true,
              platform: true,
              platformAccountId: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              accountType: true,
              scopes: true,
              status: true,
              lastSyncedAt: true,
              brandId: true,
            },
          },
          coverAsset: true,
        },
      },
    },
  })
  if (!item) return null

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: item.workspaceId, userId },
  })
  if (!member) return null
  return { item, member }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const result = await getContentItem(id, user.id)
    if (!result) return apiNotFound('Content item')
    return apiSuccess(result.item)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const result = await getContentItem(id, user.id)
    if (!result) return apiNotFound('Content item')
    const { item: existing, member } = result

    const canEdit =
      hasPermission(member.role, 'edit') ||
      (hasPermission(member.role, 'edit_own') && existing.createdBy === user.id)
    if (!canEdit) return apiError('Insufficient permissions to edit this content', 403)
    if (existing.publishingStatus === 'POSTED') {
      return apiError('Published content cannot be edited. Duplicate it to create a new post.', 409)
    }
    if (existing.publishingStatus === 'POSTING' || existing.publishingStatus === 'PROCESSING') {
      return apiError('Content cannot be edited while it is being processed', 409)
    }

    const parsed = updateContentInputSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiError(
        'Invalid content data',
        400,
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      )
    }
    const input = parsed.data
    const referenceError = await validateContentReferences(existing.workspaceId, input)
    if (referenceError) return apiError(referenceError)

    const mediaIds = input.mediaIds ? [...new Set(input.mediaIds)] : undefined
    const scheduledAt =
      input.scheduledAt === undefined
        ? undefined
        : input.scheduledAt
          ? new Date(input.scheduledAt)
          : null
    const posts = input.platformPosts?.filter((post) => post.socialAccountId)

    await prisma.$transaction(async (transaction) => {
      await transaction.contentItem.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title || null } : {}),
          ...(input.brandId !== undefined ? { brandId: input.brandId || null } : {}),
          ...(input.campaignId !== undefined ? { campaignId: input.campaignId || null } : {}),
          ...(input.internalNotes !== undefined
            ? { internalNotes: input.internalNotes || null }
            : {}),
          ...(scheduledAt !== undefined ? { scheduledAt } : {}),
          approvalStatus: 'DRAFT',
          publishingStatus: 'DRAFT',
          approvedBy: null,
          approvedAt: null,
        },
      })

      if (posts !== undefined) {
        const remainingIds = new Set(existing.platformPosts.map((p) => p.id))

        for (const post of posts) {
          const currentPost = existing.platformPosts.find((p) => p.platform === post.platform)
          const platformScheduledAt = post.scheduledAt
            ? new Date(post.scheduledAt)
            : scheduledAt ?? existing.scheduledAt
          const data = {
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
            scheduledAt: platformScheduledAt,
            status: 'DRAFT' as const,
            errorCode: null,
            errorMessage: null,
          }
          if (currentPost) {
            await transaction.platformPost.update({
              where: { id: currentPost.id },
              data,
            })
            remainingIds.delete(currentPost.id)
          } else {
            await transaction.platformPost.create({
              data: { ...data, contentItemId: id },
            })
          }
        }

        for (const staleId of remainingIds) {
          await transaction.platformPost.delete({ where: { id: staleId } })
        }
      } else {
        await transaction.platformPost.updateMany({
          where: { contentItemId: id },
          data: { status: 'DRAFT', errorCode: null, errorMessage: null },
        })
      }

      if (mediaIds !== undefined) {
        await transaction.contentAsset.deleteMany({ where: { contentItemId: id } })
        if (mediaIds.length) {
          await transaction.contentAsset.createMany({
            data: mediaIds.map((mediaAssetId, index) => ({
              contentItemId: id,
              mediaAssetId,
              sortOrder: index,
              role: index === 0 ? 'primary' : 'additional',
            })),
          })
        }
      }
    })

    await logActivity({
      workspaceId: existing.workspaceId,
      actorId: user.id,
      entityType: 'content_item',
      entityId: id,
      action: 'content.updated',
    })

    const updated = await prisma.contentItem.findUnique({
      where: { id },
      include: {
        contentAssets: { include: { mediaAsset: true }, orderBy: { sortOrder: 'asc' } },
        platformPosts: true,
      },
    })
    return apiSuccess(updated)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { userId: clerkId } = await auth()
    if (!clerkId) return apiUnauthorized()
    const user = await getCurrentUser()
    if (!user) return apiUnauthorized()

    const result = await getContentItem(id, user.id)
    if (!result) return apiNotFound('Content item')
    const { item: existing, member } = result

    const canDelete =
      hasPermission(member.role, 'delete') ||
      (hasPermission(member.role, 'delete_own') && existing.createdBy === user.id)
    if (!canDelete) return apiError('Insufficient permissions to delete this content', 403)
    if (existing.publishingStatus === 'POSTING' || existing.publishingStatus === 'PROCESSING') {
      return apiError('Content cannot be deleted while it is being processed', 409)
    }

    await prisma.contentItem.delete({ where: { id } })
    await logActivity({
      workspaceId: existing.workspaceId,
      actorId: user.id,
      entityType: 'content_item',
      entityId: id,
      action: 'content.deleted',
    })

    return apiSuccess({ deleted: true })
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
