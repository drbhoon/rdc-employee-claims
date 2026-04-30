import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";

type ClaimRow = {
  id: string;
  claimId: string;
  employeeName: string;
  totalAmount: unknown;
  currentStatus: string;
  currentPendingWith: string | null;
  submittedAt: Date | null;
};

export function ClaimTable({ claims }: { claims: ClaimRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table>
        <thead>
          <tr>
            <th>Claim ID</th><th>Employee</th><th>Amount</th><th>Status</th><th>Pending With</th><th>Submitted</th><th></th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id}>
              <td>{claim.claimId}</td>
              <td>{claim.employeeName}</td>
              <td>INR {String(claim.totalAmount)}</td>
              <td><StatusBadge status={claim.currentStatus} /></td>
              <td>{claim.currentPendingWith || "-"}</td>
              <td>{claim.submittedAt ? claim.submittedAt.toLocaleDateString("en-IN") : "-"}</td>
              <td><Link className="btn-secondary" href={`/claims/${claim.id}`}>View</Link></td>
            </tr>
          ))}
          {!claims.length && <tr><td colSpan={7} className="text-center text-muted">No claims found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
