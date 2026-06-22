-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "badgeText" TEXT,
    "image" TEXT,
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "countdownEndsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_discounts" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "productId" INTEGER,
    "categoryId" INTEGER,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DOUBLE PRECISION,
    "maxDiscountValue" DOUBLE PRECISION,
    "minOrderAmount" DOUBLE PRECISION,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offers_isActive_sortOrder_idx" ON "offers"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "offers_startsAt_endsAt_idx" ON "offers"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "offer_discounts_offerId_isActive_idx" ON "offer_discounts"("offerId", "isActive");

-- CreateIndex
CREATE INDEX "offer_discounts_productId_idx" ON "offer_discounts"("productId");

-- CreateIndex
CREATE INDEX "offer_discounts_categoryId_idx" ON "offer_discounts"("categoryId");

-- CreateIndex
CREATE INDEX "offer_discounts_startsAt_endsAt_idx" ON "offer_discounts"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "offer_discounts" ADD CONSTRAINT "offer_discounts_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_discounts" ADD CONSTRAINT "offer_discounts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_discounts" ADD CONSTRAINT "offer_discounts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
