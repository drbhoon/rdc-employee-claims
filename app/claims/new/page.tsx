import { Shell } from "@/components/Shell";
import { createOrUpdateClaim } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employeeExpenseTypes } from "@/lib/expenseTypes";

export default async function NewClaimPage() {
  const user = await requireUser(["EMPLOYEE", "ADMIN"]);
  const employee = await prisma.user.findUniqueOrThrow({ where: { employeeId: user.employeeId } });
  const claimTypes = await prisma.claimType.findMany({
    where: { isActive: true, name: { in: employeeExpenseTypes } }
  });
  const orderedClaimTypes = employeeExpenseTypes
    .map((name) => claimTypes.find((type) => type.name === name))
    .filter(Boolean) as typeof claimTypes;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Shell title="New Claim">
      <form action={createOrUpdateClaim} encType="multipart/form-data" className="space-y-4">
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div><span className="font-semibold">Employee:</span> {employee.employeeId} - {employee.name}</div>
          <div><span className="font-semibold">Department:</span> {employee.department || "-"}</div>
          <div><span className="font-semibold">Cost Center:</span> {employee.costCenter || "-"}</div>
          <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString("en-IN")}</div>
        </div>
        <div className="overflow-x-auto rounded-md border border-line bg-white">
          <table className="min-w-[1100px]">
            <thead>
              <tr>
                <th className="w-28">Date</th>
                <th className="w-[360px]">Type of Expenses - Employee</th>
                <th>Description</th>
                <th className="w-36">Amount</th>
                <th className="w-64">Supporting Document Upload</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((i) => (
                <tr key={i}>
                  <td>
                    <input type="hidden" name="claimDate" value={today} />
                    {new Date().toLocaleDateString("en-IN")}
                  </td>
                  <td>
                    <select name="claimTypeId">
                      <option value="">Select expense</option>
                      {orderedClaimTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                  </td>
                  <td><input name="description" placeholder="Short description" /></td>
                  <td><input type="number" step="0.01" min="0" name="amount" placeholder="0.00" /></td>
                  <td><input type="file" name="attachment" accept=".pdf,.jpg,.jpeg,.png" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" name="action" value="draft">Save Draft</button>
          <button className="btn" name="action" value="submit">Submit Claim</button>
        </div>
      </form>
    </Shell>
  );
}
