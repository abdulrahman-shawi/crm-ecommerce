-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "moneyTransferCommission" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "otherCommissions" DOUBLE PRECISION DEFAULT 0;
