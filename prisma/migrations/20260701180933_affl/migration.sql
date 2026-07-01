-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'AFFILIATE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "affiliateApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "affiliateApprovedAt" TIMESTAMP(3),
ADD COLUMN     "affiliateRequestedAt" TIMESTAMP(3);
