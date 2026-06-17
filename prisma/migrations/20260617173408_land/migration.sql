-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "showInAds" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "product_landing_pages" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "heroDescription" TEXT,
    "badgeText" TEXT,
    "discountPercent" INTEGER,
    "features" JSONB DEFAULT '[]',
    "showReviews" BOOLEAN NOT NULL DEFAULT true,
    "showGuarantee" BOOLEAN NOT NULL DEFAULT true,
    "guaranteeTitle" TEXT,
    "guaranteeText" TEXT,
    "ctaText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_landing_pages_productId_key" ON "product_landing_pages"("productId");

-- AddForeignKey
ALTER TABLE "product_landing_pages" ADD CONSTRAINT "product_landing_pages_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
