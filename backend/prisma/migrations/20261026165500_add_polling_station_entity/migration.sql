-- CreateTable
CREATE TABLE "PollingStation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "constituencyId" UUID NOT NULL,
    "mandalId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stationNumber" INTEGER,
    "locationCoordinates" JSONB,
    "totalVoters" INTEGER NOT NULL DEFAULT 0,
    "totalBooths" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollingStation_pkey" PRIMARY KEY ("id")
);

-- AlterTable Booth
ALTER TABLE "Booth" ADD COLUMN "pollingStationId" UUID;

-- AlterTable UserHierarchyAssignment
ALTER TABLE "UserHierarchyAssignment" ADD COLUMN "pollingStationId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "PollingStation_code_key" ON "PollingStation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PollingStation_constituencyId_mandalId_name_key" ON "PollingStation"("constituencyId", "mandalId", "name");

-- CreateIndex
CREATE INDEX "PollingStation_constituencyId_idx" ON "PollingStation"("constituencyId");

-- CreateIndex
CREATE INDEX "PollingStation_mandalId_idx" ON "PollingStation"("mandalId");

-- CreateIndex
CREATE INDEX "PollingStation_name_idx" ON "PollingStation"("name");

-- CreateIndex
CREATE INDEX "Booth_pollingStationId_idx" ON "Booth"("pollingStationId");

-- CreateIndex
CREATE INDEX "UserHierarchyAssignment_pollingStationId_idx" ON "UserHierarchyAssignment"("pollingStationId");

-- AddForeignKey
ALTER TABLE "PollingStation" ADD CONSTRAINT "PollingStation_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingStation" ADD CONSTRAINT "PollingStation_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "Mandal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booth" ADD CONSTRAINT "Booth_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "PollingStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchyAssignment" ADD CONSTRAINT "UserHierarchyAssignment_pollingStationId_fkey" FOREIGN KEY ("pollingStationId") REFERENCES "PollingStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
