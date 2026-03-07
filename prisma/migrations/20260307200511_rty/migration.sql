-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "salaryBaseWage" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "manualCreatedAt" TIMESTAMP(3),
ADD COLUMN     "pay" TEXT;
