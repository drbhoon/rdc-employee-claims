import { saveApprovalRule, saveClaimType } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/Shell";
import { EmployeeUploadPanel } from "@/components/EmployeeUploadPanel";

export default async function AdminPage() {
  await requireUser(["ADMIN"]);
  const [users, claimTypes, rules, batches] = await Promise.all([
    prisma.user.findMany({ orderBy: { employeeId: "asc" } }),
    prisma.claimType.findMany({ orderBy: { name: "asc" } }),
    prisma.approvalRule.findMany({ orderBy: { minAmount: "asc" } }),
    prisma.employeeUploadBatch.findMany({ orderBy: { uploadedAt: "desc" }, take: 5, include: { errors: true } })
  ]);
  return (
    <Shell title="Admin Dashboard">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Employee Master Upload</h2>
          <EmployeeUploadPanel />
          <div className="mt-4 overflow-x-auto"><table><thead><tr><th>File</th><th>Total</th><th>Valid</th><th>Errors</th><th>Imported</th><th>Status</th></tr></thead><tbody>{batches.map((b) => <tr key={b.id}><td>{b.fileName}</td><td>{b.totalRows}</td><td>{b.validRows}</td><td>{b.errorRows}</td><td>{b.importedRows}</td><td>{b.status}</td></tr>)}</tbody></table></div>
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Approval Rules Master</h2>
          <form action={saveApprovalRule} className="mb-4 grid gap-2 md:grid-cols-4">
            <div><label>Min Amount</label><input name="minAmount" type="number" step="0.01" required /></div>
            <div><label>Max Amount</label><input name="maxAmount" type="number" step="0.01" /></div>
            <label className="flex items-center gap-2 pt-6"><input className="w-auto" type="checkbox" name="requiresLevel1" defaultChecked />L1</label>
            <label className="flex items-center gap-2 pt-6"><input className="w-auto" type="checkbox" name="requiresLevel2" />L2</label>
            <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" name="requiresLevel3" />L3</label>
            <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" name="isActive" defaultChecked />Active</label>
            <button className="btn md:col-span-2">Add Rule</button>
          </form>
          <table><thead><tr><th>Min</th><th>Max</th><th>L1</th><th>L2</th><th>L3</th><th>Active</th></tr></thead><tbody>{rules.map((r) => <tr key={r.id}><td>{String(r.minAmount)}</td><td>{r.maxAmount ? String(r.maxAmount) : "No limit"}</td><td>{String(r.requiresLevel1)}</td><td>{String(r.requiresLevel2)}</td><td>{String(r.requiresLevel3)}</td><td>{String(r.isActive)}</td></tr>)}</tbody></table>
        </section>
      </div>
      <section className="card mt-4">
        <h2 className="mb-3 font-semibold">Claim Type Master</h2>
        <form action={saveClaimType} className="mb-4 grid gap-2 md:grid-cols-6">
          <div className="md:col-span-2"><label>Name</label><input name="name" required /></div>
          <div><label>Max Line</label><input name="maxAmountPerLine" type="number" step="0.01" /></div>
          <div><label>Monthly Limit</label><input name="monthlyLimit" type="number" step="0.01" /></div>
          <div><label>Cost Head</label><input name="costHead" /></div>
          <div><label>GL Code</label><input name="glCode" /></div>
          <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" name="attachmentRequired" />Attachment</label>
          <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" name="isActive" defaultChecked />Active</label>
          <button className="btn md:col-span-4">Add Claim Type</button>
        </form>
        <table><thead><tr><th>Name</th><th>Attachment</th><th>Max Line</th><th>Monthly</th><th>Cost Head</th><th>GL</th><th>Active</th></tr></thead><tbody>{claimTypes.map((t) => <tr key={t.id}><td>{t.name}</td><td>{String(t.attachmentRequired)}</td><td>{t.maxAmountPerLine ? String(t.maxAmountPerLine) : "-"}</td><td>{t.monthlyLimit ? String(t.monthlyLimit) : "-"}</td><td>{t.costHead || "-"}</td><td>{t.glCode || "-"}</td><td>{String(t.isActive)}</td></tr>)}</tbody></table>
      </section>
      <section className="card mt-4">
        <h2 className="mb-3 font-semibold">Employee List and Roles</h2>
        <div className="overflow-x-auto"><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Cost Center</th><th>L1</th><th>L2</th><th>L3</th><th>Active</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.employeeId}</td><td>{u.name}</td><td>{u.email || "-"}</td><td>{u.role}</td><td>{u.department || "-"}</td><td>{u.costCenter || "-"}</td><td>{u.reportingManagerId || "-"}</td><td>{u.level2ApproverId || "-"}</td><td>{u.level3ApproverId || "-"}</td><td>{String(u.isActive)}</td></tr>)}</tbody></table></div>
      </section>
    </Shell>
  );
}
