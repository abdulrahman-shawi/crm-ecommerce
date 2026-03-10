-- CreateEnum
CREATE TYPE "ActivityTargetCycle" AS ENUM ('DAILY', 'MONTHLY');

-- CreateTable
CREATE TABLE "UserActivityTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycle" "ActivityTargetCycle" NOT NULL DEFAULT 'DAILY',
    "requiredCustomers" INTEGER NOT NULL DEFAULT 0,
    "customerReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiredCommunications" INTEGER NOT NULL DEFAULT 0,
    "communicationReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserActivityTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserActivityTarget_userId_key" ON "UserActivityTarget"("userId");

-- AddForeignKey
ALTER TABLE "UserActivityTarget" ADD CONSTRAINT "UserActivityTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
