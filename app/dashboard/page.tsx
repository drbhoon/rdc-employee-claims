import Link from "next/link";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ApproverIcon, DocIcon, IdIcon, PeopleIcon, PieIcon, PinIcon, PlantIcon, PlusCircleIcon, UserIcon } from "@/components/UiIcons";

const editableStatuses = [
  "DRAFT",
  "RETURNED_BY_ACCOUNTS",
  "REJECTED_BY_ACCOUNTS",
  "REJECTED_BY_LEVEL_1",
  "REJECTED_BY_LEVEL_2",
  "REJECTED_BY_LEVEL_3"
];

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
    <Shell title="">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rdcGreen text-white shadow-md">
            <UserIcon className="h-9 w-9" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">Employee Dashboard</h1>
            <span className="hidden h-10 w-px bg-slate-300 md:inline-block" />
            <span className="text-xl font-semibold text-slate-700">{employee.name}</span>
          </div>
        </div>
        <Link className="btn gap-2 rounded-md px-5 py-3 text-base shadow-md" href="/claims/new"><PlusCircleIcon /> New Claim</Link>
      </div>
      <section className="card mb-6 p-6">
        <h2 className="mb-5 flex items-center gap-3 text-lg font-extrabold text-rdcGreen"><IdIcon className="h-7 w-7" /> Employee Information</h2>
        <div className="grid gap-5 md:grid-cols-4">
          <Info icon={<IdIcon />} label="Emp Code" value={employee.employeeId} />
          <Info icon={<PinIcon />} label="City Location" value={employee.location} />
          <Info icon={<PlantIcon />} label="Plant" value={employee.plant} />
          <Info icon={<PieIcon />} label="Cost Centre" value={employee.costCenter} />
          <Info icon={<DocIcon className="h-6 w-6" />} label="Accounts" value={employee.accountsName} />
          <Info icon={<PeopleIcon />} label="RM" value={employee.rmName} />
          <Info icon={<ApproverIcon />} label="Level1 Approver" value={employee.level1Name} />
          <Info icon={<ApproverIcon />} label="Level2 Approver" value={employee.level2Name} />
        </div>
      </section>
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
              <th>Remarks</th>
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
                <td>{claim.amendmentRemarks || "-"}</td>
                <td><Link className="btn-secondary" href={`/claims/${claim.id}`}>{editableStatuses.includes(claim.currentStatus) ? `Resume ${claim.claimId}` : claim.claimId}</Link></td>
              </tr>
            ))}
            {!lineRows.length && <tr><td colSpan={9} className="text-center text-muted">No claim lines yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex min-h-24 items-center gap-5 rounded-md border border-line bg-white p-5 shadow-sm">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-50 text-rdcGreen">{icon}</div>
      <div>
        <div className="text-xs font-semibold uppercase text-muted">{label}</div>
        <div className="mt-2 text-base font-extrabold text-ink">{value || "-"}</div>
      </div>
    </div>
  );
}
