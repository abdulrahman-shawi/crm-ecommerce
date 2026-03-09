-- CreateEnum
CREATE TYPE "WarrantyType" AS ENUM ('REPLACEMENT', 'MAINTENANCE', 'DAMAGED');

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "type" "WarrantyType" NOT NULL,
    "productId" INTEGER NOT NULL,
    "replacementProductId" INTEGER,
    "customerId" TEXT NOT NULL,
    "warehouseId" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "maintenanceLaborCost" DOUBLE PRECISION,
    "shippingCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_replacementProductId_fkey" FOREIGN KEY ("replacementProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
