import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/workspace'
import { ContentComposer } from '@/components/content/ContentComposer'

export const metadata: Metadata = { title: 'New Content' }

export default async function NewContentPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/login')
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
  })
  if (!membership) redirect('/app/settings')

  const [brands, campaigns, socialAccounts] = await Promise.all([
    prisma.brand.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { name: 'asc' },
    }),
    prisma.campaign.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { name: 'asc' },
    }),
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

  return (
    <ContentComposer
      workspaceId={membership.workspaceId}
      tiktokDirectPostEnabled={process.env.TIKTOK_DIRECT_POST_ENABLED === 'true'}
      publicMediaStorageConfigured={
        Boolean(process.env.BLOB_READ_WRITE_TOKEN) ||
        process.env.NEXT_PUBLIC_MOCK_PUBLISHING === 'true'
      }
      brands={brands}
      campaigns={campaigns}
      socialAccounts={socialAccounts}
    />
  )
}
