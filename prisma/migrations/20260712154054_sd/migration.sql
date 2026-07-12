-- CreateEnum
CREATE TYPE "WholesaleCustomerCategory" AS ENUM ('PHARMACY', 'MARKET', 'CLINIC', 'DISTRIBUTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "WholesaleVisitResult" AS ENUM ('VERY_INTERESTED', 'INTERESTED', 'THINKING', 'NOT_INTERESTED', 'PURCHASED');

-- CreateEnum
CREATE TYPE "WholesaleVisitStatus" AS ENUM ('PLANNED', 'VISITED', 'FOLLOW_UP_REQUIRED', 'CLOSED');

-- CreateTable
CREATE TABLE "WholesaleCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "WholesaleCustomerCategory" NOT NULL DEFAULT 'PHARMACY',
    "contactName" TEXT,
    "phone" TEXT[],
    "whatsappPhone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "area" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googleMapsLink" TEXT,
    "assignedUserId" TEXT,
    "notes" TEXT,
    "preferredVisitAt" TIMESTAMP(3),
    "lastVisitAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "lastVisitResult" "WholesaleVisitResult",
    "visitStatus" "WholesaleVisitStatus" NOT NULL DEFAULT 'PLANNED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleVisit" (
    "id" TEXT NOT NULL,
    "wholesaleCustomerId" TEXT NOT NULL,
    "userId" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" "WholesaleVisitResult" NOT NULL,
    "status" "WholesaleVisitStatus" NOT NULL DEFAULT 'VISITED',
    "voiceNote" TEXT,
    "notes" TEXT,
    "photoUrls" TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "nextFollowUpAt" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "orderPlaced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WholesaleVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WholesaleCustomer_assignedUserId_idx" ON "WholesaleCustomer"("assignedUserId");

-- CreateIndex
CREATE INDEX "WholesaleCustomer_city_area_idx" ON "WholesaleCustomer"("city", "area");

-- CreateIndex
CREATE INDEX "WholesaleCustomer_visitStatus_idx" ON "WholesaleCustomer"("visitStatus");

-- CreateIndex
CREATE INDEX "WholesaleCustomer_nextFollowUpAt_idx" ON "WholesaleCustomer"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "WholesaleVisit_wholesaleCustomerId_idx" ON "WholesaleVisit"("wholesaleCustomerId");

-- CreateIndex
CREATE INDEX "WholesaleVisit_userId_idx" ON "WholesaleVisit"("userId");

-- CreateIndex
CREATE INDEX "WholesaleVisit_visitedAt_idx" ON "WholesaleVisit"("visitedAt");

-- CreateIndex
CREATE INDEX "WholesaleVisit_result_idx" ON "WholesaleVisit"("result");

-- CreateIndex
CREATE INDEX "WholesaleVisit_nextFollowUpAt_idx" ON "WholesaleVisit"("nextFollowUpAt");

-- AddForeignKey
ALTER TABLE "WholesaleCustomer" ADD CONSTRAINT "WholesaleCustomer_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleVisit" ADD CONSTRAINT "WholesaleVisit_wholesaleCustomerId_fkey" FOREIGN KEY ("wholesaleCustomerId") REFERENCES "WholesaleCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleVisit" ADD CONSTRAINT "WholesaleVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
