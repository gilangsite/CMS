/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.platformPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      platform: true,
      destination: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      socialAccount: {
        select: {
          id: true,
          username: true,
          platform: true,
          status: true,
        },
      },
    }
  });
  console.log(JSON.stringify(posts, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
