-- AlterTable
ALTER TABLE "UserTarget" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
