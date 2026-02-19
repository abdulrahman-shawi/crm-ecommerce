BEGIN;

ALTER TABLE "User"
  ALTER COLUMN "salesCommissionPercent" TYPE DOUBLE PRECISION USING "salesCommissionPercent"::double precision,
  ALTER COLUMN "salesCommissionPercent" SET DEFAULT 0;

ALTER TABLE "TargetProduct"
  ALTER COLUMN "requiredQty" SET DEFAULT '{}'::INTEGER[],
  ALTER COLUMN "rewardValue" SET DEFAULT '{}'::INTEGER[];

ALTER TABLE "UserTarget"
  ADD COLUMN IF NOT EXISTS "salesCommissionPercent" INTEGER NOT NULL DEFAULT 0;

UPDATE "_prisma_migrations"
SET checksum = '1c1b875ac652ddd904fefd4ec760278587860cde593cb907ecafca81b04e619d'
WHERE migration_name = '20260218141158_fd';

COMMIT;
