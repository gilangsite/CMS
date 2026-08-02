/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const contentItemId = process.env.CONTENT_ITEM_ID;
  if (!contentItemId) throw new Error('Set CONTENT_ITEM_ID before running this diagnostic.');
  const posts = await prisma.platformPost.findMany({
    where: { contentItemId },
    select: {
      id: true,
      platform: true,
      destination: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      scheduledAt: true,
      publishedAt: true,
    },
  });
  console.log(JSON.stringify(posts, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
