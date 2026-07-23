-- Add city relation to warehouses
ALTER TABLE "Warehouse" ADD COLUMN "cityId" INTEGER;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Warehouse_cityId_idx" ON "Warehouse"("cityId");
