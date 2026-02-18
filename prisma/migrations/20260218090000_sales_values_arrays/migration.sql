-- Convert sales target/reward values to integer arrays
ALTER TABLE "UserTarget"
  ALTER COLUMN "salesTargetValue" TYPE INTEGER[] USING ARRAY["salesTargetValue"],
  ALTER COLUMN "salesRewardValue" TYPE INTEGER[] USING ARRAY["salesRewardValue"];

ALTER TABLE "UserTarget"
  ALTER COLUMN "salesTargetValue" SET DEFAULT '{}'::INTEGER[],
  ALTER COLUMN "salesRewardValue" SET DEFAULT '{}'::INTEGER[];
