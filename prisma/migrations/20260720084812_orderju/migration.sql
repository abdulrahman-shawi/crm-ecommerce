-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "wholesalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "product_wholesale_price_tiers" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_wholesale_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesale_orders" (
    "id" SERIAL NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "receiverName" TEXT,
    "receiverPhone" TEXT[],
    "country" TEXT,
    "city" TEXT,
    "municipality" TEXT,
    "fullAddress" TEXT,
    "deliveryNotes" TEXT,
    "googleMapsLink" TEXT,
    "additionalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'طلب جديد',
    "wholesaleCustomerId" TEXT NOT NULL,
    "userId" TEXT,
    "warehouseId" INTEGER,
    "manualCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wholesale_order_items" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "wholesale_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_wholesale_price_tiers_productId_idx" ON "product_wholesale_price_tiers"("productId");

-- CreateIndex
CREATE INDEX "product_wholesale_price_tiers_productId_minQuantity_idx" ON "product_wholesale_price_tiers"("productId", "minQuantity");

-- CreateIndex
CREATE UNIQUE INDEX "product_wholesale_price_tiers_productId_minQuantity_key" ON "product_wholesale_price_tiers"("productId", "minQuantity");

-- CreateIndex
CREATE UNIQUE INDEX "wholesale_orders_orderNumber_key" ON "wholesale_orders"("orderNumber");

-- CreateIndex
CREATE INDEX "wholesale_orders_createdAt_idx" ON "wholesale_orders"("createdAt");

-- CreateIndex
CREATE INDEX "wholesale_orders_wholesaleCustomerId_createdAt_idx" ON "wholesale_orders"("wholesaleCustomerId", "createdAt");

-- CreateIndex
CREATE INDEX "wholesale_orders_userId_createdAt_idx" ON "wholesale_orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "wholesale_orders_warehouseId_createdAt_idx" ON "wholesale_orders"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "wholesale_orders_status_createdAt_idx" ON "wholesale_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "wholesale_order_items_orderId_idx" ON "wholesale_order_items"("orderId");

-- CreateIndex
CREATE INDEX "wholesale_order_items_productId_idx" ON "wholesale_order_items"("productId");

-- AddForeignKey
ALTER TABLE "product_wholesale_price_tiers" ADD CONSTRAINT "product_wholesale_price_tiers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_wholesaleCustomerId_fkey" FOREIGN KEY ("wholesaleCustomerId") REFERENCES "WholesaleCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_order_items" ADD CONSTRAINT "wholesale_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "wholesale_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_order_items" ADD CONSTRAINT "wholesale_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
