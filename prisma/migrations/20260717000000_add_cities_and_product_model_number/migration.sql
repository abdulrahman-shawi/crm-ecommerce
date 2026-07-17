-- Add product model number
ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "modelNumber" TEXT;

-- Create cities table linked to countries
CREATE TABLE IF NOT EXISTS "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- Create indexes and unique constraint
CREATE INDEX IF NOT EXISTS "City_countryId_idx" ON "City"("countryId");
CREATE UNIQUE INDEX IF NOT EXISTS "City_name_countryId_key" ON "City"("name", "countryId");

-- Add foreign key to country
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'City_countryId_fkey'
    ) THEN
        ALTER TABLE "City"
        ADD CONSTRAINT "City_countryId_fkey"
        FOREIGN KEY ("countryId") REFERENCES "Country"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;