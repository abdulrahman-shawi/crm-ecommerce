-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "addWholesaleOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleteWholesaleOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editWholesaleOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewWholesaleOrders" BOOLEAN NOT NULL DEFAULT false;
