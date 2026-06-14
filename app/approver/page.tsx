import { ClaimTable } from "@/components/ClaimTable";
import { Shell } from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClaimStatus } from "@prisma/client";

type ClaimRow = {
  id: string;
  claimId: string;
  employeeName: string;
  totalAmount: unknown;
  currentStatus: string;
  currentPendingWith: string | null;
  submittedAt: Date | null;
};

function latestUniqueClaims(
  histories: { action: string; claimHeader: ClaimRow }[],
  action: "APPROVER_APPROVE" | "APPROVER_REJECT",
  blockedIds: Set<string>
) {
  const seen = new Set<string>();
  const claims: ClaimRow[] = [];
  for (const history of histories) {
    const claim = history.claimHeader;
    if (history.action !== action || seen.has(claim.id) || blockedIds.has(claim.id)) continue;
    seen.add(claim.id);
    claims.push(claim);
    if (claims.length === 20) break;
  }
  return claims;
}

export default async function ApproverPage() {
  const user = await requireUser(["APPROVER", "ADMIN"]);
  const userApproverIds = [user.email || "", user.employeeId].filter(Boolean);
  const pendingStatuses: ClaimStatus[] = ["PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL"];
  const pending = await prisma.claimHeader.findMany({
    where: {
      currentPendingWith: { in: userApproverIds },
      currentStatus: { in: pendingStatuses }
    },
    orderBy: { updatedAt: "desc" },
    take: 20
  });
  const acted = await prisma.claimApprovalHistory.findMany({
    where: {
      actionByEmployeeId: user.employeeId,
      action: { in: ["APPROVER_APPROVE", "APPROVER_REJECT"] }
    },
    include: { claimHeader: true },
    orderBy: { actionDate: "desc" },
    take: 100
  });
  const pendingIds = new Set(pending.map((claim) => claim.id));
  const approved = latestUniqueClaims(acted, "APPROVER_APPROVE", pendingIds);
  const rejected = latestUniqueClaims(acted, "APPROVER_REJECT", pendingIds);
  return (
    <Shell title="Approver Dashboard (RM / Level1 / Level2)">
      <div className="space-y-6">
        <section><h2 className="mb-2 font-semibold">Pending My Approval</h2><ClaimTable claims={pending} /></section>
        <section><h2 className="mb-2 font-semibold">Approved by Me</h2><ClaimTable claims={approved} compact /></section>
        <section><h2 className="mb-2 font-semibold">Rejected by Me</h2><ClaimTable claims={rejected} compact /></section>
      </div>
    </Shell>
  );
}
