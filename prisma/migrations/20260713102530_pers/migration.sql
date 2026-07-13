-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "addWholesaleCustomers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleteWholesaleCustomers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editWholesaleCustomers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewWholesaleCustomers" BOOLEAN NOT NULL DEFAULT false;
