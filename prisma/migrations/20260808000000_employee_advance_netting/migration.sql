CREATE TYPE "PaymentTreatment" AS ENUM ('REIMBURSEMENT', 'EMPLOYEE_ADVANCE');

ALTER TABLE "ClaimType"
ADD COLUMN "paymentTreatment" "PaymentTreatment" NOT NULL DEFAULT 'REIMBURSEMENT';

UPDATE "ClaimType"
SET "paymentTreatment" = 'EMPLOYEE_ADVANCE'
WHERE LOWER(TRIM("name")) IN ('employee advance', 'happay card recharge');

CREATE TABLE "EmployeeAdvanceBalance" (
  "employeeId" TEXT NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeAdvanceBalance_pkey" PRIMARY KEY ("employeeId")
);

ALTER TABLE "EmployeeAdvanceBalance"
ADD CONSTRAINT "EmployeeAdvanceBalance_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;
