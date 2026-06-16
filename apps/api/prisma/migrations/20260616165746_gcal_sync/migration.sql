-- AlterTable
ALTER TABLE "events" ADD COLUMN     "gcalSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gcalChannelId" TEXT,
ADD COLUMN     "gcalConnectedAt" TIMESTAMP(3),
ADD COLUMN     "gcalResourceId" TEXT,
ADD COLUMN     "gcalSyncToken" TEXT;
