import { ClaimStatus } from "@prisma/client";

export const agingClaimStatuses: ClaimStatus[] = [
  "SUBMITTED_TO_ACCOUNTS",
  "PENDING_LEVEL_1_APPROVAL",
  "PENDING_LEVEL_2_APPROVAL",
  "PENDING_LEVEL_3_APPROVAL"
];

export type AgingClaim = {
  claimId: string;
  employeeId: string;
  employeeName: string;
  totalAmount: unknown;
  currentStatus: ClaimStatus;
  currentPendingWith: string | null;
  submittedAt: Date | null;
  history: { newStatus: ClaimStatus; actionDate: Date }[];
};

export type AgingClaimRow = AgingClaim & {
  pendingSince: Date;
  ageHours: number;
};

export function claimsOlderThan72Hours(claims: AgingClaim[], now = new Date()) {
  return claims.flatMap((claim) => {
    const pendingSince = claim.history.find((item) => item.newStatus === claim.currentStatus)?.actionDate || claim.submittedAt;
    if (!pendingSince) return [];
    const ageHours = (now.getTime() - pendingSince.getTime()) / (60 * 60 * 1000);
    return ageHours > 72 ? [{ ...claim, pendingSince, ageHours }] : [];
  });
}
