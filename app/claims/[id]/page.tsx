import { notFound } from "next/navigation";
import { accountsAction, approverAction, createOrUpdateClaim } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/Shell";
import { StatusBadge } from "@/components/StatusBadge";

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
  const canAccounts = ["ACCOUNTS", "ADMIN"].includes(user.role);
  const canApprove = (user.role === "APPROVER" || user.role === "ADMIN") && claim.currentPendingWith === user.employeeId;
  const claimTypes = await prisma.claimType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

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
                  <div className="md:col-span-2"><label>Claim Type</label><select name="claimTypeId" defaultValue={line.claimTypeId}>{claimTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <div><label>Date</label><input type="date" name="claimDate" defaultValue={line.claimDate.toISOString().slice(0, 10)} /></div>
                  <div className="md:col-span-2"><label>Description</label><input name="description" defaultValue={line.description} /></div>
                  <div><label>Amount</label><input type="number" step="0.01" name="amount" defaultValue={String(line.amount)} /></div>
                  <div><label>GST</label><input type="number" step="0.01" name="gstAmount" defaultValue={line.gstAmount ? String(line.gstAmount) : ""} /></div>
                  <div><label>Bill No.</label><input name="billNumber" defaultValue={line.billNumber || ""} /></div>
                  <div className="md:col-span-2"><label>Vendor</label><input name="vendorName" defaultValue={line.vendorName || ""} /></div>
                  <div className="md:col-span-6"><label>Remarks</label><input name="employeeRemarks" defaultValue={line.employeeRemarks || ""} /></div>
                </div>
              ))}
              <div className="flex gap-2"><button className="btn-secondary" name="action" value="draft">Save Draft</button><button className="btn" name="action" value="submit">Submit Claim</button></div>
            </form>
          ) : (
            <div className="overflow-x-auto">
              <table><thead><tr><th>Type</th><th>Date</th><th>Description</th><th>Amount</th><th>GST</th><th>Vendor</th><th>Bill</th></tr></thead>
              <tbody>{claim.lines.map((l) => <tr key={l.id}><td>{l.claimType.name}</td><td>{l.claimDate.toLocaleDateString("en-IN")}</td><td>{l.description}</td><td>{String(l.amount)}</td><td>{l.gstAmount ? String(l.gstAmount) : "-"}</td><td>{l.vendorName || "-"}</td><td>{l.billNumber || "-"}</td></tr>)}</tbody></table>
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
          {canAccounts && <form action={accountsAction} className="card space-y-2"><h2 className="font-semibold">Accounts Action</h2><input type="hidden" name="id" value={claim.id} /><textarea name="comments" placeholder="Comments for return/reject" /><div className="flex flex-wrap gap-2"><button className="btn" name="action" value="pass">Pass to Approval</button><button className="btn-secondary" name="action" value="return">Return</button><button className="btn-secondary" name="action" value="reject">Reject</button><button className="btn-secondary" name="action" value="downloaded">Mark Downloaded</button><button className="btn-secondary" name="action" value="paid">Mark Paid</button></div></form>}
          {canApprove && <form action={approverAction} className="card space-y-2"><h2 className="font-semibold">Approver Action</h2><input type="hidden" name="id" value={claim.id} /><textarea name="comments" placeholder="Required for rejection" /><div className="flex gap-2"><button className="btn" name="action" value="approve">Approve</button><button className="btn-secondary" name="action" value="reject">Reject</button></div></form>}
        </aside>
      </div>
      <section className="card mt-4"><h2 className="mb-3 font-semibold">Approval History</h2><table><thead><tr><th>Date</th><th>Action By</th><th>Action</th><th>From</th><th>To</th><th>Comments</th></tr></thead><tbody>{claim.history.map((h) => <tr key={h.id}><td>{h.actionDate.toLocaleString("en-IN")}</td><td>{h.actionByName}</td><td>{h.action}</td><td>{h.previousStatus}</td><td>{h.newStatus}</td><td>{h.comments || "-"}</td></tr>)}</tbody></table></section>
    </Shell>
  );
}
