-- CreateIndex
CREATE INDEX "Voter_name_idx" ON "Voter"("name");

-- CreateIndex
CREATE INDEX "Voter_unitId_idx" ON "Voter"("unitId");

-- CreateIndex
CREATE INDEX "Voter_surveyStatus_idx" ON "Voter"("surveyStatus");

-- CreateIndex
CREATE INDEX "Voter_constituencyId_serialNumber_idx" ON "Voter"("constituencyId", "serialNumber");

-- CreateIndex
CREATE INDEX "Voter_constituencyId_boothId_idx" ON "Voter"("constituencyId", "boothId");

-- CreateIndex
CREATE INDEX "Voter_constituencyId_voteStatus_idx" ON "Voter"("constituencyId", "voteStatus");

-- CreateIndex
CREATE INDEX "Voter_constituencyId_surveyStatus_idx" ON "Voter"("constituencyId", "surveyStatus");
