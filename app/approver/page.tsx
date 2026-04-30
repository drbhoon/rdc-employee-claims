import { ClaimTable } from "@/components/ClaimTable";
import { Shell } from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ApproverPage() {
  const user = await requireUser(["APPROVER", "ADMIN"]);
  const pending = await prisma.claimHeader.findMany({ where: { currentPendingWith: user.employeeId }, orderBy: { updatedAt: "desc" } });
  const acted = await prisma.claimApprovalHistory.findMany({ where: { actionByEmployeeId: user.employeeId }, select: { claimHeaderId: true, newStatus: true } });
  const approvedIds = acted.filter((a) => !String(a.newStatus).includes("REJECTED")).map((a) => a.claimHeaderId);
  const rejectedIds = acted.filter((a) => String(a.newStatus).includes("REJECTED")).map((a) => a.claimHeaderId);
  const approved = await prisma.claimHeader.findMany({ where: { id: { in: approvedIds } }, orderBy: { updatedAt: "desc" } });
  const rejected = await prisma.claimHeader.findMany({ where: { id: { in: rejectedIds } }, orderBy: { updatedAt: "desc" } });
  return (
    <Shell title="Approver Dashboard">
      <div className="space-y-6">
        <section><h2 className="mb-2 font-semibold">Pending My Approval</h2><ClaimTable claims={pending} /></section>
        <section><h2 className="mb-2 font-semibold">Approved by Me</h2><ClaimTable claims={approved} /></section>
        <section><h2 className="mb-2 font-semibold">Rejected by Me</h2><ClaimTable claims={rejected} /></section>
      </div>
    </Shell>
  );
}
