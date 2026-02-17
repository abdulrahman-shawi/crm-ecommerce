/*
  Warnings:

  - Added the required column `commissionValue` to the `TargetProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TargetProduct" ADD COLUMN     "commissionValue" INTEGER NOT NULL;
