-- Move price and discount from Product to ProductStock
ALTER TABLE "ProductStock"
ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "ProductStock" AS ps
SET
  "price" = COALESCE(p."price", 0),
  "discount" = COALESCE(p."discount", 0)
FROM "Product" AS p
WHERE p."id" = ps."productId";

ALTER TABLE "Product"
DROP COLUMN IF EXISTS "price",
DROP COLUMN IF EXISTS "discount";

ALTER TABLE "ProductStock"
DROP COLUMN IF EXISTS "discountedPrice";
