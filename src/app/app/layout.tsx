import { syncUser } from '@/lib/auth/workspace'
import { AppLayout } from '@/components/layout/AppLayout'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await syncUser()
  } catch (err) {
    // During `next build`'s static-generation probe, auth() has no real
    // request headers yet — Next signals this via DYNAMIC_SERVER_USAGE,
    // which correctly marks these auth-gated routes as dynamic. Not a
    // real error; only log anything else (e.g. a genuine DB hiccup).
    if ((err as { digest?: string })?.digest !== 'DYNAMIC_SERVER_USAGE') {
      console.error('[DashboardLayout] syncUser failed:', err)
    }
  }

  return (
    <AppLayout>
      {children}
    </AppLayout>
  )
}
