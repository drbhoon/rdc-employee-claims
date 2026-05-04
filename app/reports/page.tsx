import { Shell } from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/workflow";
import { ClaimStatus, Prisma } from "@prisma/client";

const pendingStatuses: ClaimStatus[] = ["SUBMITTED_TO_ACCOUNTS", "PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"];
const rejectedStatuses: ClaimStatus[] = ["REJECTED_BY_ACCOUNTS", "REJECTED_BY_LEVEL_1", "REJECTED_BY_LEVEL_2", "REJECTED_BY_LEVEL_3"];
const approvedStatuses: ClaimStatus[] = ["FINAL_APPROVED", "PAYMENT_DOWNLOADED", "PAID"];

function dateRange(from?: string, to?: string) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000+05:30`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+05:30`);
  return Object.keys(range).length ? range : undefined;
}

function latestRejectionReason(history: { newStatus: string; comments: string | null }[]) {
  return history.find((item) => item.newStatus.includes("REJECTED"))?.comments || "-";
}

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  await requireUser(["ACCOUNTS", "ADMIN"]);
  const submittedAt = dateRange(searchParams.from, searchParams.to);
  const baseWhere: Prisma.ClaimHeaderWhereInput = submittedAt ? { submittedAt } : {};
  const approvedWhere: Prisma.ClaimHeaderWhereInput = {
    currentStatus: { in: approvedStatuses },
    ...(submittedAt ? { finalApprovedAt: submittedAt } : {})
  };
  const csvQuery = new URLSearchParams();
  if (searchParams.from) csvQuery.set("from", searchParams.from);
  if (searchParams.to) csvQuery.set("to", searchParams.to);
  const csvHref = `/api/reports/approved${csvQuery.size ? `?${csvQuery.toString()}` : ""}`;

  const [byStatus, byEmployee, pending, rejected, approvedClaims] = await Promise.all([
    prisma.claimHeader.groupBy({ by: ["currentStatus"], where: baseWhere, _count: true }),
    prisma.claimHeader.groupBy({ by: ["employeeId"], where: baseWhere, _sum: { totalAmount: true }, _count: true }),
    prisma.claimHeader.findMany({ where: { ...baseWhere, currentStatus: { in: pendingStatuses } }, orderBy: { updatedAt: "desc" } }),
    prisma.claimHeader.findMany({ where: { ...baseWhere, currentStatus: { in: rejectedStatuses } }, include: { history: { orderBy: { actionDate: "desc" } } }, orderBy: { updatedAt: "desc" } }),
    prisma.claimHeader.findMany({ where: approvedWhere, include: { lines: { include: { claimType: true } } } })
  ]);
  const glSummary = new Map<string, { type: string; amount: number }>();
  approvedClaims.forEach((claim) => {
    claim.lines.forEach((line) => {
      const glCode = line.claimType.glCode || "-";
      const current = glSummary.get(glCode) || { type: line.claimType.name, amount: 0 };
      current.amount += Number(line.amount);
      glSummary.set(glCode, current);
    });
  });

  return (
    <Shell title="Reports">
      <form className="card mb-4 grid gap-3 md:grid-cols-4" action="/reports">
        <div><label>From Date</label><input type="date" name="from" defaultValue={searchParams.from || ""} /></div>
        <div><label>To Date</label><input type="date" name="to" defaultValue={searchParams.to || ""} /></div>
        <div className="flex items-end gap-2 md:col-span-2">
          <button className="btn">Apply Period</button>
          <a className="btn-secondary" href="/reports">Clear</a>
          <a className="btn" href={csvHref}>Download Approved Claims CSV</a>
        </div>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card"><h2 className="mb-3 font-semibold">Claim Status Report</h2><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>{byStatus.map((r) => <tr key={r.currentStatus}><td>{statusLabel(r.currentStatus)}</td><td>{r._count}</td></tr>)}</tbody></table></section>
        <section className="card"><h2 className="mb-3 font-semibold">Employee-wise Claims</h2><table><thead><tr><th>Employee</th><th>Claims</th><th>Total</th></tr></thead><tbody>{byEmployee.map((r) => <tr key={r.employeeId}><td>{r.employeeId}</td><td>{r._count}</td><td>{r._sum.totalAmount ? String(r._sum.totalAmount) : "0"}</td></tr>)}</tbody></table></section>
        <section className="card"><h2 className="mb-3 font-semibold">Pending Approval Report</h2><table><thead><tr><th>Claim</th><th>Employee</th><th>Status</th><th>Pending With</th></tr></thead><tbody>{pending.map((c) => <tr key={c.id}><td>{c.claimId}</td><td>{c.employeeName}</td><td>{statusLabel(c.currentStatus)}</td><td>{c.currentPendingWith}</td></tr>)}</tbody></table></section>
        <section className="card"><h2 className="mb-3 font-semibold">Approved GL Summary</h2><table><thead><tr><th>GL Code</th><th>Type of Expense</th><th>Total</th></tr></thead><tbody>{Array.from(glSummary.entries()).map(([glCode, item]) => <tr key={glCode}><td>{glCode}</td><td>{item.type}</td><td>{item.amount.toFixed(2)}</td></tr>)}{!glSummary.size && <tr><td colSpan={3} className="text-center text-muted">No approved claims found.</td></tr>}</tbody></table></section>
        <section className="card lg:col-span-2"><h2 className="mb-3 font-semibold">Rejection Report</h2><table><thead><tr><th>Claim</th><th>Employee</th><th>Status</th><th>Amount</th><th>Reason</th></tr></thead><tbody>{rejected.map((c) => <tr key={c.id}><td>{c.claimId}</td><td>{c.employeeName}</td><td>{statusLabel(c.currentStatus)}</td><td>{String(c.totalAmount)}</td><td>{latestRejectionReason(c.history)}</td></tr>)}{!rejected.length && <tr><td colSpan={5} className="text-center text-muted">No rejected claims found.</td></tr>}</tbody></table></section>
      </div>
    </Shell>
  );
}
