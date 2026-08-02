'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#080b12', color: '#f5f7fb', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section style={{ width: '100%', maxWidth: 600, border: '1px solid #273043', borderRadius: 16, padding: 28, background: '#101521' }}>
            <p style={{ margin: 0, color: '#8fb3ff', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Content Command
            </p>
            <h1 style={{ margin: '12px 0 0', fontSize: 26 }}>The dashboard could not be loaded.</h1>
            <p style={{ margin: '12px 0 0', color: '#aeb8ca', fontSize: 14, lineHeight: 1.6 }}>
              Check the deployment configuration at <code>/api/health</code>, then try again. No content or uploaded files were deleted.
            </p>
            {error.digest && (
              <p style={{ margin: '12px 0 0', color: '#748097', fontSize: 12 }}>Error reference: {error.digest}</p>
            )}
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{ marginTop: 20, border: 0, borderRadius: 9, padding: '10px 16px', background: '#5b8def', color: 'white', fontWeight: 650, cursor: 'pointer' }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
