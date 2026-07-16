-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN "countryId" INTEGER;

-- Backfill countries from existing warehouse locations
INSERT INTO "Country" ("name", "createdAt", "updatedAt")
SELECT DISTINCT TRIM("location"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Warehouse"
WHERE "location" IS NOT NULL
  AND LENGTH(TRIM("location")) > 0
ON CONFLICT ("name") DO NOTHING;

UPDATE "Warehouse" AS w
SET "countryId" = c."id"
FROM "Country" AS c
WHERE TRIM(w."location") = c."name"
  AND w."countryId" IS NULL;

-- CreateIndex
CREATE INDEX "Warehouse_countryId_idx" ON "Warehouse"("countryId");

-- AddForeignKey
ALTER TABLE "Warehouse"
ADD CONSTRAINT "Warehouse_countryId_fkey"
FOREIGN KEY ("countryId") REFERENCES "Country"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
