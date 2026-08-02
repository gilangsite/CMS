import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { getMissingProductionEnvironment } from '@/lib/env/production-config'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Content Command',
    template: '%s | Content Command',
  },
  description:
    'Centralized social media content management system for planning, scheduling, approving, and publishing content to Instagram and TikTok.',
  keywords: ['social media', 'content management', 'instagram', 'tiktok', 'scheduling'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const missingEnvironment = getMissingProductionEnvironment()

  if (missingEnvironment.length > 0) {
    return (
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <body className="antialiased min-h-screen bg-background-base text-text-primary">
          <main className="min-h-screen flex items-center justify-center p-6">
            <section className="w-full max-w-2xl rounded-2xl border border-border-default bg-background-raised p-7 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-warning">Deployment setup required</p>
              <h1 className="text-2xl font-semibold mt-3">The website was deployed, but its cloud connection is incomplete.</h1>
              <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                Add or correct the variables below in Vercel under Project Settings → Environment Variables,
                enable them for Production, and redeploy. Secret values are never stored in GitHub.
              </p>
              <ul className="mt-5 space-y-2">
                {missingEnvironment.map((name) => (
                  <li key={name} className="rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2 font-mono text-xs">
                    {name}
                  </li>
                ))}
              </ul>
            </section>
          </main>
        </body>
      </html>
    )
  }

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <body className="antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
