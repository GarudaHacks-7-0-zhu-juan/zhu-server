-- CreateTable
CREATE TABLE "UserEventOutbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "UserEventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedUserEvent" (
    "consumerGroup" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedUserEvent_pkey" PRIMARY KEY ("consumerGroup","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEventOutbox_userId_sequence_key" ON "UserEventOutbox"("userId", "sequence");

-- CreateIndex
CREATE INDEX "UserEventOutbox_publishedAt_createdAt_idx" ON "UserEventOutbox"("publishedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedUserEvent_consumerGroup_eventId_key" ON "ProcessedUserEvent"("consumerGroup", "eventId");

-- AddForeignKey
ALTER TABLE "UserEventOutbox" ADD CONSTRAINT "UserEventOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
