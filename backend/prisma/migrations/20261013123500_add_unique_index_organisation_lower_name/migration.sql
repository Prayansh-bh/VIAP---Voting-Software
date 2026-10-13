-- CreateIndex
CREATE UNIQUE INDEX "Organisation_lower_name_key" ON "Organisation"(LOWER("name"));
