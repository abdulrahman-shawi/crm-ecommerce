-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('DAILY', 'STAFF_SALARY', 'RENT');

-- CreateEnum
CREATE TYPE "ExpenseCurrency" AS ENUM ('SYP', 'TRY', 'USD');

-- CreateEnum
CREATE TYPE "PaidFromOffice" AS ENUM ('TURKEY', 'SYRIA');

-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN     "currency" "ExpenseCurrency",
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "paidFromOffice" "PaidFromOffice",
ADD COLUMN     "scheduledDate" TIMESTAMP(3),
ADD COLUMN     "type" "ExpenseType" NOT NULL DEFAULT 'DAILY';

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
