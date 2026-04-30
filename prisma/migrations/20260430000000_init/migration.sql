CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'ACCOUNTS', 'APPROVER', 'ADMIN');
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED_TO_ACCOUNTS', 'RETURNED_BY_ACCOUNTS', 'REJECTED_BY_ACCOUNTS', 'PASSED_BY_ACCOUNTS', 'PENDING_LEVEL_1_APPROVAL', 'REJECTED_BY_LEVEL_1', 'PENDING_LEVEL_2_APPROVAL', 'REJECTED_BY_LEVEL_2', 'PENDING_LEVEL_3_APPROVAL', 'REJECTED_BY_LEVEL_3', 'FINAL_APPROVED', 'PAYMENT_DOWNLOADED', 'PAID');
CREATE TYPE "UploadBatchStatus" AS ENUM ('PREVIEWED', 'IMPORTED', 'FAILED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "mobile" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "department" TEXT,
  "location" TEXT,
  "plant" TEXT,
  "costCenter" TEXT,
  "reportingManagerId" TEXT,
  "level2ApproverId" TEXT,
  "level3ApproverId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClaimHeader" (
  "id" TEXT NOT NULL,
  "claimId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "department" TEXT,
  "location" TEXT,
  "plant" TEXT,
  "costCenter" TEXT,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "currentStatus" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
  "currentPendingWith" TEXT,
  "approvalLevelRequired" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3),
  "finalApprovedAt" TIMESTAMP(3),
  "paymentDownloadedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClaimHeader_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClaimLine" (
  "id" TEXT NOT NULL,
  "claimHeaderId" TEXT NOT NULL,
  "claimTypeId" TEXT NOT NULL,
  "claimDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "gstAmount" DECIMAL(12,2),
  "vendorName" TEXT,
  "billNumber" TEXT,
  "employeeRemarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClaimLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClaimAttachment" (
  "id" TEXT NOT NULL,
  "claimLineId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClaimType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "attachmentRequired" BOOLEAN NOT NULL DEFAULT false,
  "maxAmountPerLine" DECIMAL(12,2),
  "monthlyLimit" DECIMAL(12,2),
  "costHead" TEXT,
  "glCode" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClaimType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalRule" (
  "id" TEXT NOT NULL,
  "minAmount" DECIMAL(12,2) NOT NULL,
  "maxAmount" DECIMAL(12,2),
  "requiresLevel1" BOOLEAN NOT NULL DEFAULT true,
  "requiresLevel2" BOOLEAN NOT NULL DEFAULT false,
  "requiresLevel3" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClaimApprovalHistory" (
  "id" TEXT NOT NULL,
  "claimHeaderId" TEXT NOT NULL,
  "actionByEmployeeId" TEXT NOT NULL,
  "actionByName" TEXT NOT NULL,
  "roleAtAction" "Role" NOT NULL,
  "action" TEXT NOT NULL,
  "comments" TEXT,
  "previousStatus" "ClaimStatus" NOT NULL,
  "newStatus" "ClaimStatus" NOT NULL,
  "actionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimApprovalHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeUploadBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "errorRows" INTEGER NOT NULL,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "status" "UploadBatchStatus" NOT NULL DEFAULT 'PREVIEWED',
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeUploadBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeUploadError" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "employeeId" TEXT,
  "errorMessage" TEXT NOT NULL,
  CONSTRAINT "EmployeeUploadError_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "ClaimHeader_claimId_key" ON "ClaimHeader"("claimId");
CREATE UNIQUE INDEX "ClaimType_name_key" ON "ClaimType"("name");

ALTER TABLE "ClaimHeader" ADD CONSTRAINT "ClaimHeader_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaimLine" ADD CONSTRAINT "ClaimLine_claimHeaderId_fkey" FOREIGN KEY ("claimHeaderId") REFERENCES "ClaimHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClaimLine" ADD CONSTRAINT "ClaimLine_claimTypeId_fkey" FOREIGN KEY ("claimTypeId") REFERENCES "ClaimType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaimAttachment" ADD CONSTRAINT "ClaimAttachment_claimLineId_fkey" FOREIGN KEY ("claimLineId") REFERENCES "ClaimLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClaimApprovalHistory" ADD CONSTRAINT "ClaimApprovalHistory_claimHeaderId_fkey" FOREIGN KEY ("claimHeaderId") REFERENCES "ClaimHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeUploadError" ADD CONSTRAINT "EmployeeUploadError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "EmployeeUploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
