import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('\n=== RECENT CONTENT ITEMS ===')
  const items = await prisma.contentItem.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      platformPosts: {
        include: { socialAccount: true }
      }
    }
  })

  for (const item of items) {
    console.log(`\nContentItem: ${item.id}`)
    console.log(`  title: ${item.title}`)
    console.log(`  approvalStatus: ${item.approvalStatus}`)
    console.log(`  publishingStatus: ${item.publishingStatus}`)
    console.log(`  scheduledAt: ${item.scheduledAt}`)
    console.log(`  platformPosts count: ${item.platformPosts.length}`)
    for (const pp of item.platformPosts) {
      console.log(`  PlatformPost: ${pp.id}`)
      console.log(`    status: ${pp.status}`)
      console.log(`    scheduledAt: ${pp.scheduledAt}`)
      console.log(`    socialAccountId: ${pp.socialAccountId}`)
      console.log(`    socialAccount status: ${pp.socialAccount?.status ?? 'NULL'}`)
      console.log(`    socialAccount platform: ${pp.socialAccount?.platform ?? 'NULL'}`)
    }
  }

  console.log('\n=== SOCIAL ACCOUNTS ===')
  const accounts = await prisma.socialAccount.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  for (const a of accounts) {
    console.log(`  ${a.id}: platform=${a.platform} username=${a.username} status=${a.status}`)
  }

  console.log('\n=== PLATFORM POSTS WITH STATUS SCHEDULED ===')
  const scheduledPP = await prisma.platformPost.findMany({
    where: { status: 'SCHEDULED' },
    include: { socialAccount: true, contentItem: true }
  })
  console.log(`Found ${scheduledPP.length} scheduled platform posts`)
  for (const pp of scheduledPP) {
    console.log(`  PP: ${pp.id}, scheduledAt: ${pp.scheduledAt}, account status: ${pp.socialAccount?.status}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
