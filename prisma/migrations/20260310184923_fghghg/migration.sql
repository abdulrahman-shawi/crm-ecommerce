-- CreateTable
CREATE TABLE "EmployeeSalaryAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "editedSalary" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalaryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSalaryAdjustment_userId_monthKey_key" ON "EmployeeSalaryAdjustment"("userId", "monthKey");

-- AddForeignKey
ALTER TABLE "EmployeeSalaryAdjustment" ADD CONSTRAINT "EmployeeSalaryAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
