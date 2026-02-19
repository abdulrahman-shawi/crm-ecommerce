/*
  Warnings:

  - You are about to drop the column `salesCommissionPercent` on the `UserTarget` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TargetProduct" ALTER COLUMN "requiredQty" DROP DEFAULT,
ALTER COLUMN "rewardValue" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "wage" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserTarget" DROP COLUMN "salesCommissionPercent";
