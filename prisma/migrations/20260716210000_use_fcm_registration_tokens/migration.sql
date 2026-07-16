ALTER TABLE "PushDevice"
RENAME COLUMN "firebaseInstallationId" TO "registrationToken";

ALTER INDEX "PushDevice_firebaseInstallationId_key"
RENAME TO "PushDevice_registrationToken_key";
