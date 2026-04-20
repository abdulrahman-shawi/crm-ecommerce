-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "carrierCollectionReceivedAt" TIMESTAMP(3),
ADD COLUMN "carrierCollectionReceivedAmount" DOUBLE PRECISION,
ADD COLUMN "carrierCollectionNotes" TEXT;
