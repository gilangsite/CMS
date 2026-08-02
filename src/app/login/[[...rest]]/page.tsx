import { SignIn } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your CMS account',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background-base flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-[9px] bg-gradient-primary flex items-center justify-center shadow-[0_4px_14px_rgba(127,166,255,.35)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 7v10l8 5 8-5V7z" />
              <path d="M12 22V12M4 7l8 5 8-5" />
            </svg>
          </div>
          <span className="text-xl font-semibold text-text-primary tracking-tight">Content Command</span>
        </div>
        <p className="text-sm text-text-tertiary">Social Media Content Platform</p>
      </div>

      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'shadow-none border border-border-default rounded-xl bg-background-raised p-8',
            headerTitle: 'text-xl font-semibold text-text-primary',
            headerSubtitle: 'text-sm text-text-tertiary',
            socialButtonsBlockButton: 'border-border-default bg-surface-subtle hover:bg-surface-hover text-text-primary',
            dividerLine: 'bg-border-subtle',
            dividerText: 'text-text-tertiary',
            formButtonPrimary:
              'bg-gradient-primary hover:opacity-90 text-white text-sm font-medium rounded-lg h-10 transition-opacity',
            formFieldLabel: 'text-text-secondary',
            formFieldInput:
              'bg-black/20 border-border-default text-text-primary rounded-lg text-sm focus:ring-1 focus:ring-accent-primary focus:border-accent-primary',
            footerActionText: 'text-text-tertiary',
            footerActionLink: 'text-accent-primary font-medium hover:text-accent-cyan',
            identityPreviewText: 'text-text-secondary',
            identityPreviewEditButton: 'text-accent-primary',
          },
        }}
      />
    </div>
  )
}
