-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskType" AS ENUM ('DISASTER', 'HIGH_RISK_AREA');

-- CreateTable
CREATE TABLE "UserLocation" (
    "userId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserLocationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRisk" (
    "userId" TEXT NOT NULL,
    "riskType" "RiskType" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRisk_pkey" PRIMARY KEY ("userId","riskType")
);

-- CreateTable
CREATE TABLE "UserRiskEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskType" "RiskType" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRiskNotification" (
    "userId" TEXT NOT NULL,
    "riskType" "RiskType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRiskNotification_pkey" PRIMARY KEY ("userId","riskType")
);

-- CreateIndex
CREATE INDEX "UserLocationEvent_userId_detectedAt_idx" ON "UserLocationEvent"("userId", "detectedAt");

-- CreateIndex
CREATE INDEX "UserRiskEvent_userId_riskType_detectedAt_idx" ON "UserRiskEvent"("userId", "riskType", "detectedAt");

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocationEvent" ADD CONSTRAINT "UserLocationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRisk" ADD CONSTRAINT "UserRisk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRiskEvent" ADD CONSTRAINT "UserRiskEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRiskNotification" ADD CONSTRAINT "UserRiskNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
