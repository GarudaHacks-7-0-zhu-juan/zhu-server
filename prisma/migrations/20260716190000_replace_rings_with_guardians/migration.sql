/*
  Warnings:

  - You are about to drop the `UserRing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserRingMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserRingNotification` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "GuardianRelationshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- DropForeignKey
ALTER TABLE "UserRing" DROP CONSTRAINT "UserRing_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "UserRingMember" DROP CONSTRAINT "UserRingMember_memberId_fkey";

-- DropForeignKey
ALTER TABLE "UserRingMember" DROP CONSTRAINT "UserRingMember_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "UserRingMember" DROP CONSTRAINT "UserRingMember_ringId_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "UserRingNotification" DROP CONSTRAINT "UserRingNotification_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "UserRingNotification" DROP CONSTRAINT "UserRingNotification_riskEventId_fkey";

-- DropForeignKey
ALTER TABLE "UserRingNotification" DROP CONSTRAINT "UserRingNotification_senderId_fkey";

-- DropTable
DROP TABLE "UserRing";

-- DropTable
DROP TABLE "UserRingMember";

-- DropTable
DROP TABLE "UserRingNotification";

-- CreateTable
CREATE TABLE "GuardianRelationship" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "guardeeId" TEXT NOT NULL,
    "status" "GuardianRelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianRelationship_guardianId_status_idx" ON "GuardianRelationship"("guardianId", "status");

-- CreateIndex
CREATE INDEX "GuardianRelationship_guardeeId_status_idx" ON "GuardianRelationship"("guardeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelationship_guardianId_guardeeId_key" ON "GuardianRelationship"("guardianId", "guardeeId");

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardeeId_fkey" FOREIGN KEY ("guardeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A user cannot request themselves as a guardian.
ALTER TABLE "GuardianRelationship" ADD CONSTRAINT "GuardianRelationship_guardian_not_guardee" CHECK ("guardianId" <> "guardeeId");
