import { ClaimTable } from "@/components/ClaimTable";
import { Shell } from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClaimStatus } from "@prisma/client";

export default async function ApproverPage() {
  const user = await requireUser(["APPROVER", "ADMIN"]);
  const userApproverIds = [user.email || "", user.employeeId].filter(Boolean);
  const pendingStatuses: ClaimStatus[] = ["PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL"];
  const rejectedStatuses: ClaimStatus[] = ["REJECTED_BY_LEVEL_1", "REJECTED_BY_LEVEL_2", "REJECTED_BY_LEVEL_3"];
  const pending = await prisma.claimHeader.findMany({
    where: {
      currentPendingWith: { in: userApproverIds },
      currentStatus: { in: pendingStatuses }
    },
    orderBy: { updatedAt: "desc" }
  });
  const acted = await prisma.claimApprovalHistory.findMany({ where: { actionByEmployeeId: user.employeeId }, select: { claimHeaderId: true, newStatus: true } });
  const approvedIds = acted.filter((a) => !String(a.newStatus).includes("REJECTED")).map((a) => a.claimHeaderId);
  const rejectedIds = acted.filter((a) => String(a.newStatus).includes("REJECTED")).map((a) => a.claimHeaderId);
  const approved = await prisma.claimHeader.findMany({
    where: {
      id: { in: approvedIds },
      currentStatus: { notIn: rejectedStatuses },
      NOT: { currentPendingWith: { in: userApproverIds } }
    },
    orderBy: { updatedAt: "desc" }
  });
  const rejected = await prisma.claimHeader.findMany({
    where: {
      id: { in: rejectedIds },
      currentStatus: { in: rejectedStatuses }
    },
    orderBy: { updatedAt: "desc" }
  });
  return (
    <Shell title="Approver Dashboard (RM / Level1 / Level2)">
      <div className="space-y-6">
        <section><h2 className="mb-2 font-semibold">Pending My Approval</h2><ClaimTable claims={pending} /></section>
        <section><h2 className="mb-2 font-semibold">Approved by Me</h2><ClaimTable claims={approved} /></section>
        <section><h2 className="mb-2 font-semibold">Rejected by Me</h2><ClaimTable claims={rejected} /></section>
      </div>
    </Shell>
  );
}
