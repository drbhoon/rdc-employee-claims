import { Shell } from "@/components/Shell";
import { createOrUpdateClaim } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employeeExpenseTypes } from "@/lib/expenseTypes";
import { EmployeeClaimLines } from "@/components/EmployeeClaimLines";

export default async function NewClaimPage() {
  const user = await requireUser();
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
        <EmployeeClaimLines claimTypes={orderedClaimTypes} today={today} />
        <div className="flex gap-2">
          <button className="btn-secondary" name="action" value="draft">Save Draft</button>
          <button className="btn" name="action" value="submit">Submit Claim</button>
        </div>
      </form>
    </Shell>
  );
}
