export const REQUIRED_PRODUCTION_ENVIRONMENT = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'DATABASE_URL',
  'TOKEN_ENCRYPTION_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_CONFIG_ID',
  'META_REDIRECT_URI',
] as const

function isProductionHttpsUrl(value: string | undefined, expectedPath?: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return false
    }
    return expectedPath ? url.pathname === expectedPath : true
  } catch {
    return false
  }
}

export function getMissingProductionEnvironment(): string[] {
  if (process.env.NODE_ENV !== 'production') return []
  const issues = REQUIRED_PRODUCTION_ENVIRONMENT.filter((name) => !process.env[name])
  if (!isProductionHttpsUrl(process.env.NEXT_PUBLIC_APP_URL)) {
    issues.push('NEXT_PUBLIC_APP_URL')
  }
  if (!isProductionHttpsUrl(process.env.META_REDIRECT_URI, '/api/social/instagram/callback')) {
    issues.push('META_REDIRECT_URI')
  }
  return [...new Set(issues)]
}
