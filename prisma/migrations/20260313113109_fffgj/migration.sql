-- CreateEnum
CREATE TYPE "ActivityWeekDay" AS ENUM ('SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- DropIndex
DROP INDEX "UserActivityTarget_userId_key";

-- AlterTable
ALTER TABLE "UserActivityTarget" ADD COLUMN     "activeWeekDays" "ActivityWeekDay"[] DEFAULT ARRAY['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']::"ActivityWeekDay"[],
ADD COLUMN     "endedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserActivityTarget_userId_isActive_cycle_idx" ON "UserActivityTarget"("userId", "isActive", "cycle");
