import { ClaimStatus } from "@prisma/client";

export const recoverablePendingStatuses: ClaimStatus[] = [
  "SUBMITTED_TO_ACCOUNTS",
  "PASSED_BY_ACCOUNTS",
  "PENDING_LEVEL_1_APPROVAL",
  "PENDING_LEVEL_2_APPROVAL",
  "PENDING_LEVEL_3_APPROVAL"
];

export function isRecoverablePendingStatus(status: ClaimStatus) {
  return recoverablePendingStatuses.includes(status);
}
