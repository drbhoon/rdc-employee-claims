import { ClaimStatus } from "@prisma/client";

export const claimStatuses: ClaimStatus[] = [
  "DRAFT",
  "SUBMITTED_TO_ACCOUNTS",
  "RETURNED_BY_ACCOUNTS",
  "REJECTED_BY_ACCOUNTS",
  "PASSED_BY_ACCOUNTS",
  "PENDING_LEVEL_1_APPROVAL",
  "REJECTED_BY_LEVEL_1",
  "PENDING_LEVEL_2_APPROVAL",
  "REJECTED_BY_LEVEL_2",
  "PENDING_LEVEL_3_APPROVAL",
  "REJECTED_BY_LEVEL_3",
  "FINAL_APPROVED",
  "PAYMENT_DOWNLOADED",
  "PAID"
];

export const uploadColumns = [
  "action",
  "employee_id",
  "employee_name",
  "login_id",
  "password",
  "mobile",
  "department",
  "location",
  "plant",
  "cost_center",
  "accounts_name",
  "accounts_email",
  "rm_name",
  "rm_email",
  "level1_name",
  "level1_email",
  "level2_name",
  "level2_email",
  "role",
  "is_active"
];

export const allowedFileTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
