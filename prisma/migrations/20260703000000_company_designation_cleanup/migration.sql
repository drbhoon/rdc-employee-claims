-- Rename employee Department to Company and add Designation.
ALTER TABLE "User" RENAME COLUMN "department" TO "company";
ALTER TABLE "ClaimHeader" RENAME COLUMN "department" TO "company";

ALTER TABLE "User" ADD COLUMN "designation" TEXT;
ALTER TABLE "ClaimHeader" ADD COLUMN "designation" TEXT;

-- Development cleanup: remove uploaded/test transactional data and employees.
-- Master data such as claim types and approval rules is retained.
DELETE FROM "ClaimAttachment";
DELETE FROM "ClaimLine";
DELETE FROM "ClaimApprovalHistory";
DELETE FROM "ClaimHeader";
DELETE FROM "EmployeeUploadError";
DELETE FROM "EmployeeUploadBatch";
DELETE FROM "PasswordResetToken";
DELETE FROM "User"
WHERE lower(coalesce("email", '')) LIKE '%@rdc.test'
   OR ("employeeId" <> 'SUPERADMIN' AND "role" <> 'ADMIN');
