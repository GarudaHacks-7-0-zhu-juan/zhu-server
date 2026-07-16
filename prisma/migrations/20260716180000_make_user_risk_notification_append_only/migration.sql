-- Backfill: add id column with a DB-level default for existing rows
ALTER TABLE "UserRiskNotification" ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid();

-- Drop the old composite primary key
ALTER TABLE "UserRiskNotification" DROP CONSTRAINT "UserRiskNotification_pkey";

-- Add the new primary key on id
ALTER TABLE "UserRiskNotification" ADD CONSTRAINT "UserRiskNotification_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "UserRiskNotification_userId_riskType_sentAt_idx" ON "UserRiskNotification"("userId", "riskType", "sentAt");

-- Remove the DB default so Prisma's app-level @default(uuid()) generates values
ALTER TABLE "UserRiskNotification" ALTER COLUMN "id" DROP DEFAULT;
