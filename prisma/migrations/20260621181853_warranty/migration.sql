-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "addWarranty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleteWarranty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editWarranty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewWarranty" BOOLEAN NOT NULL DEFAULT false;
