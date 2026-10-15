-- AlterTable Announcement
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "organisationId" UUID;

-- CreateIndex Announcement
CREATE INDEX IF NOT EXISTS "Announcement_organisationId_idx" ON "Announcement"("organisationId");

-- AddForeignKey Announcement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Announcement_organisationId_fkey'
  ) THEN
    ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable TrainingVideo
ALTER TABLE "TrainingVideo" ADD COLUMN IF NOT EXISTS "organisationId" UUID;

-- CreateIndex TrainingVideo
CREATE INDEX IF NOT EXISTS "TrainingVideo_organisationId_idx" ON "TrainingVideo"("organisationId");

-- AddForeignKey TrainingVideo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrainingVideo_organisationId_fkey'
  ) THEN
    ALTER TABLE "TrainingVideo" ADD CONSTRAINT "TrainingVideo_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
