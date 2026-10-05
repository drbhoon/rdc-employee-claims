CREATE TABLE "VolumeUploadBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "errorRows" INTEGER NOT NULL,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "status" "UploadBatchStatus" NOT NULL DEFAULT 'PREVIEWED',
  "validatedRows" JSONB,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importedAt" TIMESTAMP(3),
  CONSTRAINT "VolumeUploadBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VolumeUploadError" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "employeeId" TEXT,
  "periodMonth" TEXT,
  "errorMessage" TEXT NOT NULL,
  CONSTRAINT "VolumeUploadError_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlySalesVolume" (
  "id" TEXT NOT NULL,
  "periodMonth" DATE NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "designation" TEXT,
  "plant" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "volumeM3" DECIMAL(14,3) NOT NULL,
  "sourceBatchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlySalesVolume_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthlySalesVolume_periodMonth_employeeId_plant_location_key"
ON "MonthlySalesVolume"("periodMonth", "employeeId", "plant", "location");

CREATE INDEX "MonthlySalesVolume_periodMonth_idx" ON "MonthlySalesVolume"("periodMonth");
CREATE INDEX "MonthlySalesVolume_employeeId_periodMonth_idx" ON "MonthlySalesVolume"("employeeId", "periodMonth");
CREATE INDEX "MonthlySalesVolume_plant_periodMonth_idx" ON "MonthlySalesVolume"("plant", "periodMonth");
CREATE INDEX "MonthlySalesVolume_location_periodMonth_idx" ON "MonthlySalesVolume"("location", "periodMonth");

ALTER TABLE "VolumeUploadError"
ADD CONSTRAINT "VolumeUploadError_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "VolumeUploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MonthlySalesVolume"
ADD CONSTRAINT "MonthlySalesVolume_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MonthlySalesVolume"
ADD CONSTRAINT "MonthlySalesVolume_sourceBatchId_fkey"
FOREIGN KEY ("sourceBatchId") REFERENCES "VolumeUploadBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
