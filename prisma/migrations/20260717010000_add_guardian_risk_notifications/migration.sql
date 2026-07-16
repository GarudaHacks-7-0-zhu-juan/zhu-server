CREATE TYPE "GuardianRiskNotificationTrigger" AS ENUM ('LIVENESS_TIMEOUT', 'NEGATIVE_RESPONSE');

CREATE TABLE "GuardianRiskNotification" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "guardeeId" TEXT NOT NULL,
    "riskType" "RiskType" NOT NULL,
    "trigger" "GuardianRiskNotificationTrigger" NOT NULL,
    "responseEventId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRiskNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianRiskNotification_guardianId_responseEventId_key" ON "GuardianRiskNotification"("guardianId", "responseEventId");
CREATE INDEX "GuardianRiskNotification_guardianId_guardeeId_riskType_trigger_sentAt_idx" ON "GuardianRiskNotification"("guardianId", "guardeeId", "riskType", "trigger", "sentAt");

ALTER TABLE "GuardianRiskNotification" ADD CONSTRAINT "GuardianRiskNotification_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianRiskNotification" ADD CONSTRAINT "GuardianRiskNotification_guardeeId_fkey" FOREIGN KEY ("guardeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
