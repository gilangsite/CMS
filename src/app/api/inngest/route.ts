import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { publishPost } from '@/inngest/functions/publish-post'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [publishPost],
})
