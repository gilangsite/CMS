export const REQUIRED_PRODUCTION_ENVIRONMENT = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'DATABASE_URL',
  'TOKEN_ENCRYPTION_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'CRON_SECRET',
] as const

export function getMissingProductionEnvironment(): string[] {
  if (process.env.NODE_ENV !== 'production') return []
  return REQUIRED_PRODUCTION_ENVIRONMENT.filter((name) => !process.env[name])
}
