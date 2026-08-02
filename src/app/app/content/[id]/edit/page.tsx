import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/workspace'
import { ContentComposer } from '@/components/content/ContentComposer'

export const metadata: Metadata = { title: 'Edit Content' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditContentPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/login')
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
  })
  if (!membership) redirect('/app/settings')

  const [contentItem, brands, campaigns, socialAccounts] = await Promise.all([
    prisma.contentItem.findFirst({
      where: { id, workspaceId: membership.workspaceId },
      select: {
        title: true,
        internalNotes: true,
        approvalStatus: true,
        brandId: true,
        campaignId: true,
        scheduledAt: true,
        contentAssets: {
          select: {
            sortOrder: true,
            mediaAsset: {
              select: {
                id: true,
                fileUrl: true,
                thumbnailUrl: true,
                fileName: true,
                mimeType: true,
                width: true,
                height: true,
                durationSeconds: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        platformPosts: {
          select: {
            id: true,
            platform: true,
            destination: true,
            caption: true,
            hashtags: true,
            mentions: true,
            collaborators: true,
            musicPlan: true,
            postMode: true,
            privacyLevel: true,
            allowComments: true,
            allowDuet: true,
            allowStitch: true,
            commercialDisclosureEnabled: true,
            commercialDisclosureType: true,
            musicUsageConfirmed: true,
            userConsentConfirmed: true,
            coverTimestampMs: true,
            scheduledAt: true,
            socialAccountId: true,
          },
        },
      },
    }),
    prisma.brand.findMany({ where: { workspaceId: membership.workspaceId }, orderBy: { name: 'asc' } }),
    prisma.campaign.findMany({ where: { workspaceId: membership.workspaceId }, orderBy: { name: 'asc' } }),
    prisma.socialAccount.findMany({
      where: { workspaceId: membership.workspaceId, status: 'CONNECTED' },
      orderBy: { platform: 'asc' },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
      },
    }),
  ])

  if (!contentItem) notFound()

  return (
    <ContentComposer
      workspaceId={membership.workspaceId}
      contentItemId={id}
      tiktokDirectPostEnabled={process.env.TIKTOK_DIRECT_POST_ENABLED === 'true'}
      publicMediaStorageConfigured={
        Boolean(process.env.BLOB_READ_WRITE_TOKEN) ||
        process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true'
      }
      initialData={contentItem}
      brands={brands}
      campaigns={campaigns}
      socialAccounts={socialAccounts}
    />
  )
}
