import { Shell } from "@/components/Shell";
import { createOrUpdateClaim } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employeeExpenseTypes } from "@/lib/expenseTypes";
import { EmployeeClaimLines } from "@/components/EmployeeClaimLines";
import { ActionButton } from "@/components/ActionButton";
import { ErrorNotice } from "@/components/ErrorNotice";
import { ClaimCertification } from "@/components/ClaimCertification";

export default async function NewClaimPage({ searchParams }: { searchParams: { error?: string } }) {
  const user = await requireUser();
  const employee = await prisma.user.findUnique({
    where: { employeeId: user.employeeId },
    select: {
      employeeId: true,
      name: true,
      company: true,
      designation: true,
      costCenter: true,
      isActive: true
    }
  });
  const claimTypes = await prisma.claimType.findMany({
    where: { isActive: true, name: { in: employeeExpenseTypes } }
  });
  const orderedClaimTypes = employeeExpenseTypes
    .map((name) => claimTypes.find((type) => type.name === name))
    .filter(Boolean) as typeof claimTypes;
  return (
    <Shell title="New Claim">
      <ErrorNotice message={searchParams.error} />
      {!employee?.isActive && (
        <ErrorNotice message="Your employee master record is missing or inactive. Please contact Admin before creating a claim." />
      )}
      {employee?.isActive && !orderedClaimTypes.length && (
        <ErrorNotice message="No active employee expense types are configured. Please ask Admin to run seed or activate claim types." />
      )}
      {employee?.isActive && orderedClaimTypes.length > 0 && (
      <form action={createOrUpdateClaim} encType="multipart/form-data" className="space-y-4">
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div><span className="font-semibold">Employee:</span> {employee.employeeId} - {employee.name}</div>
          <div><span className="font-semibold">Company:</span> {employee.company || "-"}</div>
          <div><span className="font-semibold">Designation:</span> {employee.designation || "-"}</div>
          <div><span className="font-semibold">Cost Center:</span> {employee.costCenter || "-"}</div>
          <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString("en-IN")}</div>
        </div>
        <EmployeeClaimLines claimTypes={orderedClaimTypes} />
        <ClaimCertification />
        <div className="flex gap-2">
          <button className="btn-secondary" name="action" value="draft" formNoValidate>Save Draft</button>
          <ActionButton name="action" value="submit" variant="primary" confirmMessage="Are you sure you want to submit this claim?">Submit Claim</ActionButton>
        </div>
      </form>
      )}
    </Shell>
  );
}
