-- Remove rows that use the NotificationType value being dropped
DELETE FROM "notifications" WHERE "type" = 'LOW_STOCK';

-- DropTable
DROP TABLE "inventory_items";

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'SERVICE_REQUEST', 'MAINTENANCE', 'PENDING_PAYMENT', 'WHATSAPP', 'HOUSEKEEPING');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;
