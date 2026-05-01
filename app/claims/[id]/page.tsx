import { notFound } from "next/navigation";
import { accountsAction, approverAction, createOrUpdateClaim } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";
import { employeeExpenseTypes } from "@/lib/expenseTypes";
import { ActionButton } from "@/components/ActionButton";

export default async function ClaimDetail({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const claim = await prisma.claimHeader.findUnique({
    where: { id: params.id },
    include: { lines: { include: { claimType: true, attachments: true } }, history: { orderBy: { actionDate: "desc" } } }
  });
  if (!claim) notFound();
  const canSee = user.role === "ADMIN" || user.role === "ACCOUNTS" || claim.employeeId === user.employeeId || claim.currentPendingWith === user.employeeId || claim.history.some((h) => h.actionByEmployeeId === user.employeeId);
  if (!canSee) notFound();
  const canEdit = claim.employeeId === user.employeeId && ["DRAFT", "RETURNED_BY_ACCOUNTS"].includes(claim.currentStatus);
  const canAccountsAudit = ["ACCOUNTS", "ADMIN"].includes(user.role) && claim.currentStatus === "SUBMITTED_TO_ACCOUNTS";
  const canMarkPaymentDownloaded = ["ACCOUNTS", "ADMIN"].includes(user.role) && claim.currentStatus === "FINAL_APPROVED";
  const canMarkPaid = ["ACCOUNTS", "ADMIN"].includes(user.role) && claim.currentStatus === "PAYMENT_DOWNLOADED";
  const canApprove = (user.role === "APPROVER" || user.role === "ADMIN") && claim.currentPendingWith === user.employeeId && ["PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"].includes(claim.currentStatus);
  const claimTypes = await prisma.claimType.findMany({ where: { isActive: true, name: { in: employeeExpenseTypes } } });
  const orderedClaimTypes = employeeExpenseTypes
    .map((name) => claimTypes.find((type) => type.name === name))
    .filter(Boolean) as typeof claimTypes;

  return (
    <Shell title={`Claim ${claim.claimId}`}>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div><label>Status</label><div className="mt-2"><StatusBadge status={claim.currentStatus} /></div></div>
            <div><label>Total</label><div className="mt-2 font-bold">INR {String(claim.totalAmount)}</div></div>
            <div><label>Pending With</label><div className="mt-2">{claim.currentPendingWith || "-"}</div></div>
            <div><label>Submitted</label><div className="mt-2">{claim.submittedAt?.toLocaleString("en-IN") || "-"}</div></div>
          </div>
          {canEdit ? (
            <form action={createOrUpdateClaim} className="space-y-3">
              <input type="hidden" name="id" value={claim.id} />
              {claim.lines.map((line) => (
                <div key={line.id} className="grid gap-2 border-t border-line pt-3 md:grid-cols-8">
                  <input type="hidden" name="claimDate" value={line.claimDate.toISOString().slice(0, 10)} />
                  <div className="md:col-span-3"><label>Type of Expenses</label><select name="claimTypeId" defaultValue={line.claimTypeId}>{orderedClaimTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <div className="md:col-span-3"><label>Description</label><input name="description" defaultValue={line.description} /></div>
                  <div className="md:col-span-2"><label>Amount</label><input type="number" step="0.01" name="amount" defaultValue={String(line.amount)} /></div>
                </div>
              ))}
              <div className="flex gap-2"><button className="btn-secondary" name="action" value="draft">Save Draft</button><button className="btn" name="action" value="submit">Submit Claim</button></div>
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
