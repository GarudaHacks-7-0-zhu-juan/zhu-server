/*
  Warnings:

  - A unique constraint covering the columns `[phoneNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deviceId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "phoneNumber" TEXT;

-- CreateTable
CREATE TABLE "UserRing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ringNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRingMember" (
    "ownerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ringId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRingMember_pkey" PRIMARY KEY ("ownerId","memberId")
);

-- CreateTable
CREATE TABLE "UserRingNotification" (
    "id" TEXT NOT NULL,
    "ringNumber" INTEGER NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "riskType" "RiskType" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRingNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRing_ownerId_ringNumber_key" ON "UserRing"("ownerId", "ringNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserRing_id_ownerId_key" ON "UserRing"("id", "ownerId");

-- CreateIndex
CREATE INDEX "UserRingMember_ringId_idx" ON "UserRingMember"("ringId");

-- CreateIndex
CREATE INDEX "UserRingNotification_senderId_sentAt_idx" ON "UserRingNotification"("senderId", "sentAt");

-- CreateIndex
CREATE INDEX "UserRingNotification_receiverId_sentAt_idx" ON "UserRingNotification"("receiverId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceId_key" ON "User"("deviceId");

-- AddForeignKey
ALTER TABLE "UserRing" ADD CONSTRAINT "UserRing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRingMember" ADD CONSTRAINT "UserRingMember_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRingMember" ADD CONSTRAINT "UserRingMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRingMember" ADD CONSTRAINT "UserRingMember_ringId_ownerId_fkey" FOREIGN KEY ("ringId", "ownerId") REFERENCES "UserRing"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRingNotification" ADD CONSTRAINT "UserRingNotification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRingNotification" ADD CONSTRAINT "UserRingNotification_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not support these database-level validation constraints.
ALTER TABLE "UserRing" ADD CONSTRAINT "UserRing_ringNumber_positive" CHECK ("ringNumber" > 0);
ALTER TABLE "UserRingMember" ADD CONSTRAINT "UserRingMember_owner_not_member" CHECK ("ownerId" <> "memberId");
ALTER TABLE "UserRingNotification" ADD CONSTRAINT "UserRingNotification_ringNumber_positive" CHECK ("ringNumber" > 0);
ALTER TABLE "UserRingNotification" ADD CONSTRAINT "UserRingNotification_sender_not_receiver" CHECK ("senderId" <> "receiverId");
