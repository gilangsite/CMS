-- AlterTable
ALTER TABLE "platform_posts" ADD COLUMN     "collaborators" TEXT[] DEFAULT ARRAY[]::TEXT[];
