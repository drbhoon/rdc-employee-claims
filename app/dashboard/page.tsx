import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export default async function Dashboard() {
  const user = await requireUser();
  const employee = await prisma.user.findUniqueOrThrow({
    where: { employeeId: user.employeeId },
    select: {
      employeeId: true,
      name: true,
      location: true,
      plant: true,
      costCenter: true,
      accountsName: true,
      rmName: true,
      level1Name: true,
      level2Name: true
    }
  });
  const claims = await prisma.claimHeader.findMany({
    where: { employeeId: user.employeeId },
    include: { lines: { include: { claimType: true, attachments: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" }
  });
  const pendingIds = [...new Set(claims.map((claim) => claim.currentPendingWith).filter(Boolean) as string[])];
  const pendingUsers = await prisma.user.findMany({
    where: { employeeId: { in: pendingIds } },
    select: { employeeId: true, name: true }
  });
  const pendingName = new Map(pendingUsers.map((pendingUser) => [pendingUser.employeeId, pendingUser.name]));
  const counts = {
    Draft: claims.filter((claim) => claim.currentStatus === "DRAFT").length,
    Pending: claims.filter((claim) => ["SUBMITTED_TO_ACCOUNTS", "PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"].includes(claim.currentStatus)).length,
    Returned: claims.filter((claim) => claim.currentStatus === "RETURNED_BY_ACCOUNTS").length,
    Rejected: claims.filter((claim) => claim.currentStatus.includes("REJECTED")).length,
    Approved: claims.filter((claim) => claim.currentStatus === "FINAL_APPROVED").length,
    Paid: claims.filter((claim) => claim.currentStatus === "PAID").length
  };
  const lineRows = claims.flatMap((claim) => claim.lines.map((line) => ({ claim, line })));

  function pendingLabel(claim: (typeof claims)[number]) {
    if (claim.currentStatus === "SUBMITTED_TO_ACCOUNTS") return "Pending with Accounts";
    if (claim.currentStatus === "PENDING_LEVEL_1_APPROVAL") return `Pending with RM${claim.currentPendingWith ? ` (${pendingName.get(claim.currentPendingWith) || claim.currentPendingWith})` : ""}`;
    if (claim.currentStatus === "PENDING_LEVEL_2_APPROVAL") return `Pending with BH${claim.currentPendingWith ? ` (${pendingName.get(claim.currentPendingWith) || claim.currentPendingWith})` : ""}`;
    if (claim.currentStatus === "PENDING_LEVEL_3_APPROVAL") return `Pending with Level 3${claim.currentPendingWith ? ` (${pendingName.get(claim.currentPendingWith) || claim.currentPendingWith})` : ""}`;
    if (claim.currentStatus === "DRAFT") return "Draft";
    if (claim.currentStatus === "RETURNED_BY_ACCOUNTS") return "Returned for correction";
    if (claim.currentStatus === "FINAL_APPROVED") return "Approved";
    if (claim.currentStatus === "PAYMENT_DOWNLOADED") return "Payment downloaded";
    if (claim.currentStatus === "PAID") return "Paid";
    if (claim.currentStatus.includes("REJECTED")) return "Rejected";
    return claim.currentPendingWith || "-";
  }

  return (
    <Shell title="Employee Dashboard">
      <section className="card mb-4">
        <h2 className="mb-3 font-semibold">Employee Information</h2>
        <div className="grid gap-3 text-sm md:grid-cols-4">
          <Info label="Emp Code" value={employee.employeeId} />
          <Info label="Emp Name" value={employee.name} />
          <Info label="City Location" value={employee.location} />
          <Info label="Plant" value={employee.plant} />
          <Info label="Cost Centre" value={employee.costCenter} />
          <Info label="Accounts" value={employee.accountsName} />
          <Info label="RM" value={employee.rmName} />
          <Info label="Level1 Approver" value={employee.level1Name} />
          <Info label="Level2 Approver" value={employee.level2Name} />
        </div>
      </section>
      <div className="mb-4 flex justify-end"><Link className="btn" href="/claims/new">New Claim</Link></div>
      <div className="mb-5 grid gap-3 md:grid-cols-6">
        {Object.entries(counts).map(([label, value]) => (
          <div className="card" key={label}>
            <div className="text-sm text-muted">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-white">
        <table className="min-w-[1100px]">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type of Expenses - Employee</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Supporting Document</th>
              <th>Status</th>
              <th>Pending / Result</th>
              <th>Claim</th>
            </tr>
          </thead>
          <tbody>
            {lineRows.map(({ claim, line }) => (
              <tr key={line.id}>
                <td>{line.claimDate.toLocaleDateString("en-IN")}</td>
                <td className="max-w-sm">{line.claimType.name}</td>
                <td>{line.description}</td>
                <td>INR {String(line.amount)}</td>
                <td>
                  {line.attachments.length
                    ? line.attachments.map((attachment) => <a className="block text-accent" href={attachment.fileUrl} key={attachment.id} target="_blank">{attachment.fileName}</a>)
                    : "-"}
                </td>
                <td><StatusBadge status={claim.currentStatus} /></td>
                <td>{pendingLabel(claim)}</td>
                <td><Link className="btn-secondary" href={`/claims/${claim.id}`}>{claim.claimId}</Link></td>
              </tr>
            ))}
            {!lineRows.length && <tr><td colSpan={8} className="text-center text-muted">No claim lines yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded border border-line bg-panel p-3">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 font-semibold">{value || "-"}</div>
    </div>
  );
}
