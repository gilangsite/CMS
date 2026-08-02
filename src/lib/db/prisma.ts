import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

declare global {
  var prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL

  // Prisma v7 requires a driver adapter for the "client" engine type.
  // We use the Neon serverless adapter for both Neon and standard Postgres URLs.
  if (!url) {
    console.warn(
      '[Prisma] DATABASE_URL is not set. Database queries will fail. ' +
        'Add DATABASE_URL to .env.local and run: npx prisma migrate dev'
    )
  }
  const adapter = new PrismaNeon({
    connectionString:
      url ?? 'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder',
  })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
