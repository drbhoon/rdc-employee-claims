import Link from "next/link";
import { Shell } from "@/components/Shell";
import { ClaimTable } from "@/components/ClaimTable";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function Dashboard() {
  const user = await requireUser();
  const claims = await prisma.claimHeader.findMany({ where: { employeeId: user.employeeId }, orderBy: { updatedAt: "desc" } });
  const counts = {
    Draft: claims.filter((c) => c.currentStatus === "DRAFT").length,
    Pending: claims.filter((c) => ["SUBMITTED_TO_ACCOUNTS", "PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"].includes(c.currentStatus)).length,
    Returned: claims.filter((c) => c.currentStatus === "RETURNED_BY_ACCOUNTS").length,
    Rejected: claims.filter((c) => c.currentStatus.includes("REJECTED")).length,
    Approved: claims.filter((c) => c.currentStatus === "FINAL_APPROVED").length,
    Paid: claims.filter((c) => c.currentStatus === "PAID").length
  };
  return (
    <Shell title="Employee Dashboard">
      <div className="mb-4 flex justify-end"><Link className="btn" href="/claims/new">New Claim</Link></div>
      <div className="mb-5 grid gap-3 md:grid-cols-6">
        {Object.entries(counts).map(([k, v]) => <div className="card" key={k}><div className="text-sm text-muted">{k}</div><div className="text-2xl font-bold">{v}</div></div>)}
      </div>
      <ClaimTable claims={claims} />
    </Shell>
  );
}
