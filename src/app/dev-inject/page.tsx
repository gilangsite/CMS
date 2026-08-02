'use client'

import { useState } from 'react'

// ⚠️ DEV-ONLY PAGE: Remove this file before deploying to production!
// Usage: Open http://localhost:3000/dev-inject in browser while logged in to CMS.

export default function DevInjectPage() {
  const [token, setToken] = useState('')
  const [result, setResult] = useState<{ success?: boolean; error?: string; [key: string]: unknown } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/social/instagram/dev-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token.trim() }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err: unknown) {
      setResult({ error: err instanceof Error ? err.message : 'Request failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      padding: '24px',
    }}>
      <div style={{
        background: '#111',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '32px',
        width: '100%',
        maxWidth: '640px',
      }}>
        <div style={{ marginBottom: '24px' }}>
          <span style={{
            background: '#7c3aed',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '1px',
          }}>DEV ONLY</span>
          <h1 style={{ color: 'white', margin: '12px 0 4px', fontSize: '20px' }}>
            🔧 Instagram Token Injector
          </h1>
          <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
            Bypass OAuth popup. Paste your long-lived access token from Graph API Explorer.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
            Long-Lived Access Token
          </label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAAX7Jap..."
            rows={4}
            style={{
              width: '100%',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#e5e5e5',
              padding: '12px',
              fontSize: '13px',
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !token.trim()}
            style={{
              marginTop: '16px',
              width: '100%',
              background: loading ? '#333' : '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? '⏳ Menghubungkan...' : '🚀 Connect Instagram'}
          </button>
        </form>

        {result && (
          <div style={{
            marginTop: '24px',
            background: result.success ? '#052e16' : '#1c0505',
            border: `1px solid ${result.success ? '#16a34a' : '#dc2626'}`,
            borderRadius: '8px',
            padding: '16px',
          }}>
            <p style={{
              color: result.success ? '#4ade80' : '#f87171',
              fontWeight: 'bold',
              margin: '0 0 8px',
              fontSize: '15px',
            }}>
              {result.success ? '✅ Berhasil!' : '❌ Error'}
            </p>
            <pre style={{
              color: '#aaa',
              fontSize: '12px',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
            {result.success && (
              <a href="/app/social-accounts" style={{
                display: 'block',
                marginTop: '16px',
                textAlign: 'center',
                background: '#16a34a',
                color: 'white',
                padding: '10px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 'bold',
              }}>
                → Lihat Social Accounts
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
