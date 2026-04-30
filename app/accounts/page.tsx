import { ClaimTable } from "@/components/ClaimTable";
import { Shell } from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountsPage() {
  await requireUser(["ACCOUNTS", "ADMIN"]);
  const claims = await prisma.claimHeader.findMany({ orderBy: { updatedAt: "desc" } });
  const groups = [
    ["Pending Accounts Audit", ["SUBMITTED_TO_ACCOUNTS"]],
    ["Returned by Accounts", ["RETURNED_BY_ACCOUNTS"]],
    ["Passed by Accounts", ["PASSED_BY_ACCOUNTS", "PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"]],
    ["Final Approved", ["FINAL_APPROVED"]],
    ["Payment Downloaded", ["PAYMENT_DOWNLOADED"]],
    ["Paid", ["PAID"]]
  ] as const;
  return (
    <Shell title="Accounts Dashboard">
      <div className="mb-4"><a className="btn" href="/api/reports/approved">Download Approved Claims CSV</a></div>
      <div className="space-y-6">
        {groups.map(([title, statuses]) => <section key={title}><h2 className="mb-2 font-semibold">{title}</h2><ClaimTable claims={claims.filter((c) => statuses.includes(c.currentStatus as never))} /></section>)}
      </div>
    </Shell>
  );
}
