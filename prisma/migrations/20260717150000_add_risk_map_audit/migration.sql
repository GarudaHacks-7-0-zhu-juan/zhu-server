ALTER TABLE "UserRiskEvent"
ADD COLUMN "locationEventId" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "riskScore" DECIMAL(5,4),
ADD COLUMN "riskPolicyVersion" TEXT,
ADD COLUMN "outsideCoverage" BOOLEAN;

CREATE UNIQUE INDEX "UserRiskEvent_locationEventId_riskType_key"
ON "UserRiskEvent"("locationEventId", "riskType");
