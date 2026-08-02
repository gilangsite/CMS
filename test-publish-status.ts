import prisma from './src/lib/db/prisma'

async function main() {
  const post = await prisma.platformPost.findUnique({
    where: { id: 'cmp83f4ke000ajixuoq4wnw3w' },
    select: { status: true, errorMessage: true, errorCode: true }
  })
  console.log(JSON.stringify(post, null, 2))
}
main().catch(console.error)
