import { Shell } from "@/components/Shell";
import { hasNationalReportAccess, requireReportViewer } from "@/lib/auth";
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

export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string; glCode?: string } }) {
  const user = await requireReportViewer();
  const nationalAccess = hasNationalReportAccess(user);
  const selectedGlCode = searchParams.glCode && searchParams.glCode !== "ALL" ? searchParams.glCode : "ALL";
  const submittedAt = dateRange(searchParams.from, searchParams.to);
  const accessWhere: Prisma.ClaimHeaderWhereInput = nationalAccess ? {} : { history: { some: { action: "ACCOUNTS_PASS", actionByEmployeeId: user.employeeId } } };
  const glWhere: Prisma.ClaimHeaderWhereInput = selectedGlCode !== "ALL" ? { lines: { some: { claimType: { glCode: selectedGlCode } } } } : {};
  const baseWhere: Prisma.ClaimHeaderWhereInput = { ...accessWhere, ...glWhere, ...(submittedAt ? { submittedAt } : {}) };
  const approvedWhere: Prisma.ClaimHeaderWhereInput = {
    ...accessWhere,
    currentStatus: { in: approvedStatuses },
    ...(submittedAt ? { finalApprovedAt: submittedAt } : {}),
    ...glWhere
  };
  const csvQuery = new URLSearchParams();
  if (searchParams.from) csvQuery.set("from", searchParams.from);
  if (searchParams.to) csvQuery.set("to", searchParams.to);
  if (selectedGlCode !== "ALL") csvQuery.set("glCode", selectedGlCode);
  const csvHref = `/api/reports/approved${csvQuery.size ? `?${csvQuery.toString()}` : ""}`;
  const claimWiseQuery = new URLSearchParams();
  if (searchParams.from) claimWiseQuery.set("from", searchParams.from);
  if (searchParams.to) claimWiseQuery.set("to", searchParams.to);
  const claimWiseHref = `/api/reports/approved-claimwise${claimWiseQuery.size ? `?${claimWiseQuery.toString()}` : ""}`;

  const [byStatus, byEmployee, pending, rejected, approvedClaims, claimTypes] = await Promise.all([
    prisma.claimHeader.groupBy({ by: ["currentStatus"], where: baseWhere, _count: true }),
    prisma.claimHeader.groupBy({ by: ["employeeId"], where: baseWhere, _sum: { totalAmount: true }, _count: true }),
    prisma.claimHeader.findMany({ where: { ...baseWhere, currentStatus: { in: pendingStatuses } }, orderBy: { updatedAt: "desc" } }),
    prisma.claimHeader.findMany({ where: { ...baseWhere, currentStatus: { in: rejectedStatuses } }, include: { history: { orderBy: { actionDate: "desc" } } }, orderBy: { updatedAt: "desc" } }),
    prisma.claimHeader.findMany({ where: approvedWhere, include: { lines: { where: selectedGlCode !== "ALL" ? { claimType: { glCode: selectedGlCode } } : undefined, include: { claimType: true } } } }),
    prisma.claimType.findMany({ where: { isActive: true, glCode: { not: null } }, select: { glCode: true }, orderBy: { glCode: "asc" } })
  ]);
  const glCodes = [...new Set(claimTypes.map((type) => type.glCode).filter(Boolean) as string[])];
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
      <form className="card mb-4 grid gap-3 md:grid-cols-5" action="/reports">
        <div><label>From Date</label><input type="date" name="from" defaultValue={searchParams.from || ""} /></div>
        <div><label>To Date</label><input type="date" name="to" defaultValue={searchParams.to || ""} /></div>
        <div><label>By GL Code</label><select name="glCode" defaultValue={selectedGlCode}><option value="ALL">All GL Codes</option>{glCodes.map((code) => <option key={code} value={code}>{code}</option>)}</select></div>
        <div className="flex items-start gap-2 md:col-span-2">
          <button className="btn">Apply Filters</button>
          <a className="btn-secondary" href="/reports">Clear</a>
          <div className="flex flex-col items-start gap-2">
            <a className="btn whitespace-nowrap" href={csvHref}>{nationalAccess ? "Download Approved Claims - GL Wise" : "Download My Cleared Claims - GL Wise"}</a>
            <a className="btn whitespace-nowrap" href={claimWiseHref}>{nationalAccess ? "Download Approved Claims - Claim ID Wise" : "Download My Cleared Claims - Claim ID Wise"}</a>
          </div>
        </div>
        <p className="text-xs text-muted md:col-span-5">Both downloads use final approval date. The GL-wise report applies the selected GL code; the Claim ID-wise payment report ignores GL code and includes one row per claim awaiting payment. Accounts without national rights receive only claims they cleared.</p>
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
