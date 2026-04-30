import { Shell } from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage() {
  await requireUser(["ACCOUNTS", "ADMIN"]);
  const [byStatus, byEmployee, pending, rejected] = await Promise.all([
    prisma.claimHeader.groupBy({ by: ["currentStatus"], _count: true }),
    prisma.claimHeader.groupBy({ by: ["employeeId"], _sum: { totalAmount: true }, _count: true }),
    prisma.claimHeader.findMany({ where: { currentStatus: { in: ["SUBMITTED_TO_ACCOUNTS", "PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"] } }, orderBy: { updatedAt: "desc" } }),
    prisma.claimHeader.findMany({ where: { currentStatus: { in: ["REJECTED_BY_ACCOUNTS", "REJECTED_BY_LEVEL_1", "REJECTED_BY_LEVEL_2", "REJECTED_BY_LEVEL_3"] } }, orderBy: { updatedAt: "desc" } })
  ]);
  return (
    <Shell title="Reports">
      <div className="mb-4"><a className="btn" href="/api/reports/approved">Download Approved Claims CSV</a></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Claim Status Report</h2><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>{byStatus.map((r) => <tr key={r.currentStatus}><td>{r.currentStatus}</td><td>{r._count}</td></tr>)}</tbody></table></section>
        <section className="card"><h2 className="mb-3 font-semibold">Employee-wise Claims</h2><table><thead><tr><th>Employee</th><th>Claims</th><th>Total</th></tr></thead><tbody>{byEmployee.map((r) => <tr key={r.employeeId}><td>{r.employeeId}</td><td>{r._count}</td><td>{r._sum.totalAmount ? String(r._sum.totalAmount) : "0"}</td></tr>)}</tbody></table></section>
        <section className="card"><h2 className="mb-3 font-semibold">Pending Approval Report</h2><table><thead><tr><th>Claim</th><th>Employee</th><th>Status</th><th>Pending With</th></tr></thead><tbody>{pending.map((c) => <tr key={c.id}><td>{c.claimId}</td><td>{c.employeeName}</td><td>{c.currentStatus}</td><td>{c.currentPendingWith}</td></tr>)}</tbody></table></section>
        <section className="card"><h2 className="mb-3 font-semibold">Rejection Report</h2><table><thead><tr><th>Claim</th><th>Employee</th><th>Status</th><th>Amount</th></tr></thead><tbody>{rejected.map((c) => <tr key={c.id}><td>{c.claimId}</td><td>{c.employeeName}</td><td>{c.currentStatus}</td><td>{String(c.totalAmount)}</td></tr>)}</tbody></table></section>
      </div>
    </Shell>
  );
}
