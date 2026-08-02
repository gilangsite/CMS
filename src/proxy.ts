import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * Only authenticated application and API routes pass through Clerk.
 * Marketing/auth pages, OAuth callbacks, platform webhooks, cron, and Inngest
 * are deliberately excluded at the matcher level. Besides reducing overhead,
 * this avoids development handshake loops on the custom /login page.
 */
export default clerkMiddleware(async (auth) => {
  await auth.protect()
})

export const config = {
  matcher: [
    '/app/:path*',
    '/api/((?!health(?:/|$)|webhooks(?:/|$)|cron(?:/|$)|inngest(?:/|$)|social/instagram/callback(?:/|$)|social/tiktok/callback(?:/|$)).*)',
  ],
}
