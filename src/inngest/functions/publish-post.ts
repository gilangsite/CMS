import { inngest } from '@/inngest/client'
import { processPlatformPost } from '@/lib/publishing/process-platform-post'

/**
 * Optional Inngest worker. The Vercel cron also processes due posts directly,
 * so publishing remains functional even before an Inngest app is registered.
 */
export const publishPost = inngest.createFunction(
  {
    id: 'cms/publish-post',
    name: 'Publish Platform Post',
    retries: 2,
    throttle: {
      limit: 10,
      period: '1m',
    },
    triggers: [{ event: 'cms/post.publish.requested' as const }],
  },
  async ({ event }) => {
    const { platformPostId, workspaceId } = event.data as {
      platformPostId: string
      workspaceId: string
    }
    return processPlatformPost(platformPostId, workspaceId)
  }
)
