/*
  Warnings:

  - You are about to drop the column `customerMissPenaltyPercent` on the `UserActivityTarget` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserActivityTarget" DROP COLUMN "customerMissPenaltyPercent",
ADD COLUMN     "communicationMissPenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "customerMissPenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
