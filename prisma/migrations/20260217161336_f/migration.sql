-- Add sales target and reward values to user targets
ALTER TABLE "UserTarget" ADD COLUMN "salesRewardValue" INTEGER NOT NULL,
ADD COLUMN "salesTargetValue" INTEGER NOT NULL;
