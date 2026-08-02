import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/db/prisma'
import {
  apiError,
  apiServerError,
  apiSuccess,
  apiUnauthorized,
} from '@/lib/api-response'
import { getCurrentUser } from '@/lib/auth/workspace'

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
      select: { id: true },
    })
    if (!member) return apiError('Not a member of this workspace', 403)

    const [reviews, failedPosts, manualPosts, unhealthyAccounts, posted] = await Promise.all([
      prisma.contentItem.findMany({
        where: { workspaceId, approvalStatus: 'IN_REVIEW' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, title: true, updatedAt: true },
      }),
      prisma.platformPost.findMany({
        where: { contentItem: { workspaceId }, status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          contentItemId: true,
          errorMessage: true,
          updatedAt: true,
          contentItem: { select: { title: true } },
        },
      }),
      prisma.platformPost.findMany({
        where: { contentItem: { workspaceId }, status: 'NEEDS_MANUAL_FINALIZATION' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          contentItemId: true,
          updatedAt: true,
          contentItem: { select: { title: true } },
        },
      }),
      prisma.socialAccount.findMany({
        where: { workspaceId, status: { in: ['EXPIRED', 'ERROR', 'DISCONNECTED'] } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, displayName: true, username: true, platform: true, updatedAt: true },
      }),
      prisma.platformPost.findMany({
        where: {
          contentItem: { workspaceId },
          status: 'POSTED',
          publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { publishedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          contentItemId: true,
          publishedAt: true,
          contentItem: { select: { title: true } },
        },
      }),
    ])

    const notifications = [
      ...failedPosts.map((post) => ({
        id: `failed:${post.id}:${post.updatedAt.toISOString()}`,
        type: 'publishing_failed',
        message: `${post.contentItem.title || 'Untitled'} failed to publish${post.errorMessage ? `: ${post.errorMessage}` : '.'}`,
        createdAt: post.updatedAt,
        link: `/app/content/${post.contentItemId}`,
      })),
      ...reviews.map((item) => ({
        id: `review:${item.id}:${item.updatedAt.toISOString()}`,
        type: 'approval_requested',
        message: `${item.title || 'Untitled'} is ready for review.`,
        createdAt: item.updatedAt,
        link: `/app/content/${item.id}`,
      })),
      ...manualPosts.map((post) => ({
        id: `manual:${post.id}:${post.updatedAt.toISOString()}`,
        type: 'draft_ready',
        message: `${post.contentItem.title || 'Untitled'} needs to be finalized in the social app.`,
        createdAt: post.updatedAt,
        link: `/app/content/${post.contentItemId}`,
      })),
      ...unhealthyAccounts.map((account) => ({
        id: `account:${account.id}:${account.updatedAt.toISOString()}`,
        type: 'token_expiring',
        message: `${account.displayName || account.username || account.platform} needs to be reconnected.`,
        createdAt: account.updatedAt,
        link: '/app/social-accounts',
      })),
      ...posted.map((post) => ({
        id: `posted:${post.id}:${post.publishedAt?.toISOString()}`,
        type: 'posted',
        message: `${post.contentItem.title || 'Untitled'} was published successfully.`,
        createdAt: post.publishedAt ?? new Date(),
        link: `/app/content/${post.contentItemId}`,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 30)

    return apiSuccess(notifications)
  } catch (error: unknown) {
    return apiServerError(error)
  }
}
