/*
  Warnings:

  - You are about to drop the column `commissionValue` on the `TargetProduct` table. All the data in the column will be lost.
  - You are about to drop the column `targetDate` on the `TargetProduct` table. All the data in the column will be lost.
  - You are about to drop the column `commissionValue` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `targetDate` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `targetReward` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `commissionValue` on the `UserTarget` table. All the data in the column will be lost.
  - You are about to drop the column `rewardValue` on the `UserTarget` table. All the data in the column will be lost.
  - You are about to drop the column `targetDate` on the `UserTarget` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `UserTarget` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TargetProduct" DROP COLUMN "commissionValue",
DROP COLUMN "targetDate";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "commissionValue",
DROP COLUMN "targetDate",
DROP COLUMN "targetReward";

-- AlterTable
ALTER TABLE "UserTarget" DROP COLUMN "commissionValue",
DROP COLUMN "rewardValue",
DROP COLUMN "targetDate",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
