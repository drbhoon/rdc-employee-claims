ALTER TABLE "User"
ADD COLUMN "canDownloadNationalReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canUploadPayments" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClaimHeader"
ADD COLUMN "paymentReference" TEXT,
ADD COLUMN "paymentRemarks" TEXT;

CREATE TABLE "PaymentUploadBatch" (
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
  CONSTRAINT "PaymentUploadBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentUploadError" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "claimId" TEXT,
  "employeeId" TEXT,
  "errorMessage" TEXT NOT NULL,
  CONSTRAINT "PaymentUploadError_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentUploadError"
ADD CONSTRAINT "PaymentUploadError_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "PaymentUploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
