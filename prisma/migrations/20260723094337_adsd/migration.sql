-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_createdById_fkey";

-- AlterTable
ALTER TABLE "campaigns" ALTER COLUMN "title" SET DATA TYPE TEXT,
ALTER COLUMN "subject" SET DATA TYPE TEXT,
ALTER COLUMN "createdById" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
