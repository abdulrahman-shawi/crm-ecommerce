-- Sync target arrays and commission percent
ALTER TABLE "TargetProduct"
  ALTER COLUMN "requiredQty" TYPE INTEGER[] USING ARRAY["requiredQty"],
  ALTER COLUMN "rewardValue" TYPE INTEGER[] USING ARRAY["rewardValue"],
  ALTER COLUMN "requiredQty" SET DEFAULT '{}'::INTEGER[],
  ALTER COLUMN "rewardValue" SET DEFAULT '{}'::INTEGER[];

ALTER TABLE "UserTarget"
  ADD COLUMN "salesCommissionPercent" INTEGER NOT NULL DEFAULT 0;
