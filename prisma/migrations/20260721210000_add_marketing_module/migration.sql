-- Campaign enums
CREATE TYPE "CampaignType" AS ENUM ('EMAIL', 'SOCIAL', 'SMS', 'CONTENT');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CampaignAudience" AS ENUM ('ALL_CUSTOMERS', 'ALL_WHOLESALE', 'CUSTOM');

-- Marketing permissions
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "viewMarketing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "addMarketing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "editMarketing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "deleteMarketing" BOOLEAN NOT NULL DEFAULT false;

-- Campaigns table
CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" SERIAL PRIMARY KEY,
    "title" VARCHAR(255) NOT NULL,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" VARCHAR(255),
    "content" TEXT NOT NULL,
    "channelDetails" JSONB DEFAULT '{}',
    "audience" "CampaignAudience" NOT NULL DEFAULT 'ALL_CUSTOMERS',
    "targetIds" JSONB DEFAULT '[]',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "metrics" JSONB DEFAULT '{"sent":0,"opened":0,"clicked":0,"converted":0}',
    "createdById" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "campaigns_type_idx" ON "campaigns"("type");
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status");
CREATE INDEX IF NOT EXISTS "campaigns_createdById_idx" ON "campaigns"("createdById");
CREATE INDEX IF NOT EXISTS "campaigns_scheduledAt_idx" ON "campaigns"("scheduledAt");
