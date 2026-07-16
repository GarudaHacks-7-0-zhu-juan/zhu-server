-- CreateEnum
CREATE TYPE "AccidentEventType" AS ENUM ('FALL_DETECTED', 'MOVEMENT');

-- AlterEnum
ALTER TYPE "RiskType" ADD VALUE 'ACCIDENT';

-- CreateTable
CREATE TABLE "UserAccidentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "AccidentEventType" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccidentEvent_userId_eventType_detectedAt_idx" ON "UserAccidentEvent"("userId", "eventType", "detectedAt");

-- AddForeignKey
ALTER TABLE "UserAccidentEvent" ADD CONSTRAINT "UserAccidentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
