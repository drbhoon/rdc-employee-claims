import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";

type ClaimRow = {
  id: string;
  claimId: string;
  employeeName: string;
  totalAmount: unknown;
  amendmentRemarks?: string | null;
  currentStatus: string;
  currentPendingWith: string | null;
  submittedAt: Date | null;
};

const editableStatuses = [
  "DRAFT",
  "RETURNED_BY_ACCOUNTS",
  "REJECTED_BY_ACCOUNTS",
  "REJECTED_BY_LEVEL_1",
  "REJECTED_BY_LEVEL_2",
  "REJECTED_BY_LEVEL_3"
];

export function ClaimTable({ claims, compact = false, showResumeAction = false }: { claims: ClaimRow[]; compact?: boolean; showResumeAction?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className={compact ? "text-xs" : undefined}>
        <thead>
          <tr>
            <th>Claim ID</th><th>Employee</th><th>Amount</th><th>Status</th>{!compact && <th>Pending With</th>}<th>Submitted</th>{!compact && <th>Remarks</th>}<th></th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => {
            const actionLabel = showResumeAction && editableStatuses.includes(claim.currentStatus) ? "Resume" : "View";
            return (
              <tr key={claim.id}>
                <td>{claim.claimId}</td>
                <td>{claim.employeeName}</td>
                <td>INR {String(claim.totalAmount)}</td>
                <td><StatusBadge status={claim.currentStatus} /></td>
                {!compact && <td>{claim.currentPendingWith || "-"}</td>}
                <td>{claim.submittedAt ? claim.submittedAt.toLocaleDateString("en-IN") : "-"}</td>
                {!compact && <td>{claim.amendmentRemarks || "-"}</td>}
                <td><Link className={compact ? "btn-secondary px-2 py-1 text-xs" : "btn-secondary"} href={`/claims/${claim.id}`}>{actionLabel}</Link></td>
              </tr>
            );
          })}
          {!claims.length && <tr><td colSpan={compact ? 6 : 8} className="text-center text-muted">No claims found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
