/*
  Warnings:

  - You are about to drop the `UserTargetProduct` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserTargetProduct" DROP CONSTRAINT "UserTargetProduct_productId_fkey";

-- DropForeignKey
ALTER TABLE "UserTargetProduct" DROP CONSTRAINT "UserTargetProduct_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionValue" INTEGER,
ADD COLUMN     "targetDate" TIMESTAMP(3),
ADD COLUMN     "targetReward" INTEGER;

-- DropTable
DROP TABLE "UserTargetProduct";

-- CreateTable
CREATE TABLE "UserTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "rewardValue" INTEGER NOT NULL,
    "commissionValue" INTEGER NOT NULL,

    CONSTRAINT "UserTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetProduct" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "requiredQty" INTEGER NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "rewardValue" INTEGER NOT NULL,

    CONSTRAINT "TargetProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TargetProduct_targetId_productId_key" ON "TargetProduct"("targetId", "productId");

-- AddForeignKey
ALTER TABLE "UserTarget" ADD CONSTRAINT "UserTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProduct" ADD CONSTRAINT "TargetProduct_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "UserTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProduct" ADD CONSTRAINT "TargetProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
