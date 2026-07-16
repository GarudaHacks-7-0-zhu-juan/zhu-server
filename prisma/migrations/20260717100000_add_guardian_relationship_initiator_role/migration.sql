-- Existing relationships were created through the guardee invitation flow.
CREATE TYPE "GuardianRelationshipInitiatorRole" AS ENUM ('GUARDIAN', 'GUARDEE');

ALTER TABLE "GuardianRelationship"
ADD COLUMN "initiatorRole" "GuardianRelationshipInitiatorRole" NOT NULL DEFAULT 'GUARDEE';

ALTER TABLE "GuardianRelationship"
ALTER COLUMN "initiatorRole" DROP DEFAULT;
