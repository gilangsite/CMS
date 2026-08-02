import { redirect } from 'next/navigation'

export default async function HomePage() {
  // In production with Clerk configured, this would check auth.
  // For frontend demo mode, redirect directly to dashboard.
  redirect('/app/dashboard')
}
