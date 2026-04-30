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
  "employee_id",
  "employee_name",
  "email",
  "mobile",
  "department",
  "location",
  "plant",
  "cost_center",
  "reporting_manager_id",
  "level_2_approver_id",
  "level_3_approver_id",
  "role",
  "is_active"
];

export const allowedFileTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
