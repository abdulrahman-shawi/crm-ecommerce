/*
  Warnings:

  - You are about to drop the column `replacementProductId` on the `Warranty` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Warranty" DROP CONSTRAINT "Warranty_replacementProductId_fkey";

-- AlterTable
ALTER TABLE "Warranty" DROP COLUMN "replacementProductId";
