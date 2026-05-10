import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/Shell";
import { EmployeeUploadPanel } from "@/components/EmployeeUploadPanel";
import { EmailTestPanel } from "@/components/EmailTestPanel";
import { ResetDatabasePanel } from "@/components/ResetDatabasePanel";

export default async function AdminPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireSuperAdmin();
  const [claimTypes, batches] = await Promise.all([
    prisma.claimType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
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
        <table><thead><tr><th>Name</th><th>Attachment</th><th>Max Line</th><th>Monthly</th><th>Cost Head</th><th>GL</th><th>Active</th></tr></thead><tbody>{claimTypes.map((t) => <tr key={t.id}><td>{t.name}</td><td>{String(t.attachmentRequired)}</td><td>{t.maxAmountPerLine ? String(t.maxAmountPerLine) : "-"}</td><td>{t.monthlyLimit ? String(t.monthlyLimit) : "-"}</td><td>{t.costHead || "-"}</td><td>{t.glCode || "-"}</td><td>{String(t.isActive)}</td></tr>)}</tbody></table>
      </section>
      <section className="card mt-4">
        <h2 className="mb-3 font-semibold">Employee Master</h2>
        <a className="btn-secondary" href="/api/admin/employees/export">Download Employee Master</a>
      </section>
    </Shell>
  );
}
