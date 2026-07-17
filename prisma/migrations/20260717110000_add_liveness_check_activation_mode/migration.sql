CREATE TYPE "LivenessCheckActivationMode" AS ENUM ('OFF', 'MANUAL', 'AUTO');

ALTER TABLE "UserRisk"
ADD COLUMN "livenessCheckActivationMode" "LivenessCheckActivationMode" NOT NULL DEFAULT 'OFF';

UPDATE "UserRisk"
SET "livenessCheckActivationMode" = CASE
  WHEN "livenessCheckEnabled" THEN 'AUTO'::"LivenessCheckActivationMode"
  ELSE 'OFF'::"LivenessCheckActivationMode"
END;

ALTER TABLE "UserRisk" DROP COLUMN "livenessCheckEnabled";
