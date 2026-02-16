-- CreateTable
CREATE TABLE "UserTargetProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "requiredQty" INTEGER NOT NULL,

    CONSTRAINT "UserTargetProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTargetProduct_userId_productId_key" ON "UserTargetProduct"("userId", "productId");

-- AddForeignKey
ALTER TABLE "UserTargetProduct" ADD CONSTRAINT "UserTargetProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTargetProduct" ADD CONSTRAINT "UserTargetProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
