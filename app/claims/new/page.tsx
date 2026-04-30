import { Shell } from "@/components/Shell";
import { createOrUpdateClaim } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewClaimPage() {
  const user = await requireUser(["EMPLOYEE", "ADMIN"]);
  const employee = await prisma.user.findUniqueOrThrow({ where: { employeeId: user.employeeId } });
  const claimTypes = await prisma.claimType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return (
    <Shell title="New Claim">
      <form action={createOrUpdateClaim} className="space-y-4">
        <div className="card grid gap-3 md:grid-cols-4">
          <div><label>Employee ID</label><input value={employee.employeeId} readOnly /></div>
          <div><label>Name</label><input value={employee.name} readOnly /></div>
          <div><label>Department</label><input value={employee.department || ""} readOnly /></div>
          <div><label>Cost Center</label><input value={employee.costCenter || ""} readOnly /></div>
        </div>
        <div className="card space-y-3">
          <h2 className="font-semibold">Claim Lines</h2>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid gap-2 border-t border-line pt-3 md:grid-cols-8">
              <div className="md:col-span-2"><label>Claim Type</label><select name="claimTypeId"><option value="">Select</option>{claimTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label>Date</label><input type="date" name="claimDate" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div className="md:col-span-2"><label>Description</label><input name="description" /></div>
              <div><label>Amount</label><input type="number" step="0.01" min="0" name="amount" /></div>
              <div><label>GST</label><input type="number" step="0.01" min="0" name="gstAmount" /></div>
              <div><label>Bill No.</label><input name="billNumber" /></div>
              <div className="md:col-span-2"><label>Vendor</label><input name="vendorName" /></div>
              <div className="md:col-span-6"><label>Remarks</label><input name="employeeRemarks" /></div>
            </div>
          ))}
          <p className="text-sm text-muted">Use additional rows only when required. Attachments can be added from the claim detail after saving draft or submitting.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" name="action" value="draft">Save Draft</button>
          <button className="btn" name="action" value="submit">Submit Claim</button>
        </div>
      </form>
    </Shell>
  );
}
