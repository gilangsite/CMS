import prisma from '@/lib/db/prisma'
import type { PlatformPostInput } from '@/lib/content/schemas'

interface ContentReferences {
  brandId?: string | null
  campaignId?: string | null
  mediaIds?: string[]
  platformPosts?: PlatformPostInput[]
}

export async function validateContentReferences(
  workspaceId: string,
  input: ContentReferences
): Promise<string | null> {
  const mediaIds = [...new Set(input.mediaIds ?? [])]
  const platformPosts = input.platformPosts ?? []
  const accountIds = [
    ...new Set(platformPosts.map((post) => post.socialAccountId).filter((id): id is string => !!id)),
  ]

  const [brand, campaign, mediaCount, accounts] = await Promise.all([
    input.brandId
      ? prisma.brand.findFirst({ where: { id: input.brandId, workspaceId }, select: { id: true } })
      : null,
    input.campaignId
      ? prisma.campaign.findFirst({
          where: { id: input.campaignId, workspaceId },
          select: { id: true },
        })
      : null,
    mediaIds.length
      ? prisma.mediaAsset.count({
          where: { id: { in: mediaIds }, workspaceId, deletedAt: null },
        })
      : 0,
    accountIds.length
      ? prisma.socialAccount.findMany({
          where: { id: { in: accountIds }, workspaceId },
          select: { id: true, platform: true, status: true },
        })
      : [],
  ])

  if (input.brandId && !brand) return 'The selected brand does not belong to this workspace'
  if (input.campaignId && !campaign) return 'The selected campaign does not belong to this workspace'
  if (mediaCount !== mediaIds.length) {
    return 'One or more media files are unavailable or have been moved to Trash'
  }

  const platformsSeen = new Set<string>()
  for (const post of platformPosts) {
    if (platformsSeen.has(post.platform)) {
      return 'Only one destination per platform is allowed'
    }
    platformsSeen.add(post.platform)

    if (post.socialAccountId) {
      const account = accounts.find((a) => a.id === post.socialAccountId)
      if (!account) return 'The selected social account does not belong to this workspace'
      if (account.platform !== post.platform) {
        return 'The selected social account does not match the destination platform'
      }
      if (account.status !== 'CONNECTED') return 'The selected social account is not connected'
    }

    const destinationPlatform = post.destination.startsWith('instagram')
      ? 'INSTAGRAM'
      : post.destination.startsWith('tiktok')
        ? 'TIKTOK'
        : null
    if (destinationPlatform && destinationPlatform !== post.platform) {
      return 'Destination and platform do not match'
    }
  }

  return null
}
