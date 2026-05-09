import { saveClaimType } from "@/lib/actions";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/Shell";
import { EmployeeUploadPanel } from "@/components/EmployeeUploadPanel";
import { EmailTestPanel } from "@/components/EmailTestPanel";
import { ResetDatabasePanel } from "@/components/ResetDatabasePanel";

export default async function AdminPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireSuperAdmin();
  const [users, claimTypes, batches] = await Promise.all([
    prisma.user.findMany({ orderBy: { employeeId: "asc" } }),
    prisma.claimType.findMany({ orderBy: { name: "asc" } }),
    prisma.employeeUploadBatch.findMany({ orderBy: { uploadedAt: "desc" }, take: 5, include: { errors: true } })
  ]);
  return (
    <Shell title="Admin Dashboard">
      {searchParams.error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</div>}
      <div className="grid gap-4">
        <section className="card">
          <h2 className="mb-3 font-semibold">Employee Master Upload</h2>
          <EmployeeUploadPanel />
          <div className="mt-4 overflow-x-auto"><table><thead><tr><th>File</th><th>Total</th><th>Valid</th><th>Errors</th><th>Imported</th><th>Status</th></tr></thead><tbody>{batches.map((b) => <tr key={b.id}><td>{b.fileName}</td><td>{b.totalRows}</td><td>{b.validRows}</td><td>{b.errorRows}</td><td>{b.importedRows}</td><td>{b.status}</td></tr>)}</tbody></table></div>
        </section>
      </div>
      <section className="card mt-4">
        <h2 className="mb-3 font-semibold">Email Test</h2>
        <EmailTestPanel defaultTo={user.email || ""} />
      </section>
      <section className="card mt-4">
        <h2 className="mb-3 font-semibold">Clean Test Data</h2>
        <ResetDatabasePanel />
      </section>
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
        <div className="overflow-x-auto"><table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Accounts</th><th>RM</th><th>Level1</th><th>Level2</th><th>Active</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td>{u.employeeId}</td><td>{u.name}</td><td>{u.email || "-"}</td><td>{u.role}</td><td>{u.accountsEmail || "-"}</td><td>{u.rmEmail || "-"}</td><td>{u.level1Email || "-"}</td><td>{u.level2Email || "-"}</td><td>{String(u.isActive)}</td></tr>)}</tbody></table></div>
      </section>
    </Shell>
  );
}
