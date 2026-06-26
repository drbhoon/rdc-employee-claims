import { notFound } from "next/navigation";
import { accountsAction, approverAction, createOrUpdateClaim } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { employeeExpenseTypes } from "@/lib/expenseTypes";
import { ActionButton } from "@/components/ActionButton";
import { ErrorNotice } from "@/components/ErrorNotice";
import { EmployeeClaimLines } from "@/components/EmployeeClaimLines";

const editableStatuses = [
  "DRAFT",
  "RETURNED_BY_ACCOUNTS",
  "REJECTED_BY_ACCOUNTS",
  "REJECTED_BY_LEVEL_1",
  "REJECTED_BY_LEVEL_2",
  "REJECTED_BY_LEVEL_3"
];

export default async function ClaimDetail({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const user = await requireUser();
  const claim = await prisma.claimHeader.findUnique({
    where: { id: params.id },
    include: { employee: true, lines: { include: { claimType: true, attachments: true } }, history: { orderBy: { actionDate: "desc" } } }
  });
  if (!claim) notFound();
  const canSee =
    user.role === "ADMIN" ||
    (user.role === "ACCOUNTS" && claim.employee.accountsEmail === user.email) ||
    claim.employeeId === user.employeeId ||
    claim.currentPendingWith === user.employeeId ||
    claim.currentPendingWith === user.email ||
    claim.history.some((h) => h.actionByEmployeeId === user.employeeId);
  if (!canSee) notFound();
  const canEdit = claim.employeeId === user.employeeId && editableStatuses.includes(claim.currentStatus);
  const canAccountsAudit = ["ACCOUNTS", "ADMIN"].includes(user.role) && claim.currentStatus === "SUBMITTED_TO_ACCOUNTS";
  const canMarkPaymentDownloaded = ["ACCOUNTS", "ADMIN"].includes(user.role) && claim.currentStatus === "FINAL_APPROVED";
  const canMarkPaid = ["ACCOUNTS", "ADMIN"].includes(user.role) && claim.currentStatus === "PAYMENT_DOWNLOADED";
  const canApprove =
    (user.role === "APPROVER" || user.role === "ADMIN") &&
    (claim.currentPendingWith === user.employeeId || claim.currentPendingWith === user.email || user.role === "ADMIN") &&
    ["PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL"].includes(claim.currentStatus);
  const claimTypes = await prisma.claimType.findMany({ where: { isActive: true, name: { in: employeeExpenseTypes } } });
  const orderedClaimTypes = employeeExpenseTypes
    .map((name) => claimTypes.find((type) => type.name === name))
    .filter(Boolean) as typeof claimTypes;
  const rejectionReason = claim.history.find((h) => String(h.newStatus).includes("REJECTED"))?.comments;

  return (
    <Shell title={`Claim ${claim.claimId}`}>
      <ErrorNotice message={searchParams.error} />
      {claim.currentStatus.includes("REJECTED") && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-semibold">Rejection reason:</span> {rejectionReason || "No reason recorded."}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div><label>Status</label><div className="mt-2"><StatusBadge status={claim.currentStatus} /></div></div>
            <div><label>Total</label><div className="mt-2 font-bold">INR {String(claim.totalAmount)}</div></div>
            <div><label>Pending With</label><div className="mt-2">{claim.currentPendingWith || "-"}</div></div>
            <div><label>Submitted</label><div className="mt-2">{claim.submittedAt?.toLocaleString("en-IN") || "-"}</div></div>
          </div>
          {claim.amendmentRemarks && (
            <div className="mb-4">
              <label>Amendment Remarks</label>
              <div className="mt-2 rounded-md border border-line bg-panel px-3 py-2 text-sm">{claim.amendmentRemarks}</div>
            </div>
          )}
          {canEdit ? (
            <form action={createOrUpdateClaim} encType="multipart/form-data" className="space-y-3">
              <input type="hidden" name="id" value={claim.id} />
              {claim.currentStatus !== "DRAFT" && (
                <div>
                  <label>Amendment Remarks</label>
                  <textarea name="amendmentRemarks" defaultValue={claim.amendmentRemarks || ""} placeholder="Explain the amendment before resubmitting" />
                </div>
              )}
              <EmployeeClaimLines
                claimTypes={orderedClaimTypes}
                initialLines={claim.lines.map((line) => ({
                  id: line.id,
                  claimDate: line.claimDate.toISOString().slice(0, 10),
                  claimTypeId: line.claimTypeId,
                  description: line.description,
                  amount: String(line.amount)
                }))}
              />
              <div className="flex gap-2"><button className="btn-secondary" name="action" value="draft">Save Draft</button><ActionButton name="action" value="submit" variant="primary" confirmMessage="Are you sure you want to submit this claim?">Submit Claim</ActionButton></div>
            </form>
          ) : (
            <div className="overflow-x-auto">
              <table><thead><tr><th>Date</th><th>Type of Expenses</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>{claim.lines.map((l) => <tr key={l.id}><td>{l.claimDate.toLocaleDateString("en-IN")}</td><td>{l.claimType.name}</td><td>{l.description}</td><td>{String(l.amount)}</td></tr>)}</tbody></table>
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <div className="card">
            <h2 className="mb-3 font-semibold">Attachments</h2>
            {claim.lines.map((line) => (
              <div key={line.id} className="mb-3 border-b border-line pb-3">
                <div className="mb-2 text-sm font-semibold">{line.claimType.name}</div>
                {line.attachments.map((a) => <a className="block text-sm text-accent" key={a.id} href={a.fileUrl} target="_blank">{a.fileName}</a>)}
                {canEdit && <form action="/api/attachments" method="post" encType="multipart/form-data" className="mt-2"><input type="hidden" name="claimLineId" value={line.id} /><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" /><button className="btn-secondary mt-2">Upload</button></form>}
              </div>
            ))}
          </div>
          {(canAccountsAudit || canMarkPaymentDownloaded || canMarkPaid) && (
            <form action={accountsAction} className="card space-y-2">
              <h2 className="font-semibold">Accounts Action</h2>
              <input type="hidden" name="id" value={claim.id} />
              {canAccountsAudit && <textarea name="comments" placeholder="Comments for return/reject" />}
              <div className="flex flex-wrap gap-2">
                {canAccountsAudit && <ActionButton name="action" value="pass" variant="primary">Pass to Approval</ActionButton>}
                {canAccountsAudit && <ActionButton name="action" value="return">Return</ActionButton>}
                {canAccountsAudit && <ActionButton name="action" value="reject">Reject</ActionButton>}
                {canMarkPaymentDownloaded && <ActionButton name="action" value="downloaded">Mark Downloaded</ActionButton>}
                {canMarkPaid && <ActionButton name="action" value="paid">Mark Paid</ActionButton>}
              </div>
            </form>
          )}
          {canApprove && <form action={approverAction} className="card space-y-2"><h2 className="font-semibold">Approver Action</h2><input type="hidden" name="id" value={claim.id} /><textarea name="comments" placeholder="Required for rejection" /><div className="flex gap-2"><ActionButton name="action" value="approve" variant="primary">Approve</ActionButton><ActionButton name="action" value="reject">Reject</ActionButton></div></form>}
        </aside>
      </div>
      <section className="card mt-4"><h2 className="mb-3 font-semibold">Approval History</h2><table><thead><tr><th>Date</th><th>Action By</th><th>Action</th><th>From</th><th>To</th><th>Comments</th></tr></thead><tbody>{claim.history.map((h) => <tr key={h.id}><td>{h.actionDate.toLocaleString("en-IN")}</td><td>{h.actionByName}</td><td>{h.action}</td><td>{h.previousStatus}</td><td>{h.newStatus}</td><td>{h.comments || "-"}</td></tr>)}</tbody></table></section>
    </Shell>
  );
}
