-- CreateTable
CREATE TABLE "GuardianRiskNotification" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "guardeeId" TEXT NOT NULL,
    "riskType" "RiskType" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRiskNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianRiskNotification_guardianId_guardeeId_riskType_sentAt_idx" ON "GuardianRiskNotification"("guardianId", "guardeeId", "riskType", "sentAt");

-- AddForeignKey
ALTER TABLE "GuardianRiskNotification" ADD CONSTRAINT "GuardianRiskNotification_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRiskNotification" ADD CONSTRAINT "GuardianRiskNotification_guardeeId_fkey" FOREIGN KEY ("guardeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
