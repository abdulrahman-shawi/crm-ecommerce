-- Add sales target and reward values to user targets
ALTER TABLE "UserTarget" ADD COLUMN "salesTargetValue" INTEGER DEFAULT 0;
ALTER TABLE "UserTarget" ADD COLUMN "salesRewardValue" INTEGER DEFAULT 0;
