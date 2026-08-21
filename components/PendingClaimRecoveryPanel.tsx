"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PendingClaim = {
  id: string;
  claimId: string;
  employeeId: string;
  employeeName: string;
  totalAmount: string;
  currentStatus: string;
  currentPendingWith: string | null;
  submittedAt: string | null;
  attachmentCount: number;
};

const indiaDateTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "medium" });

function statusLabel(status: string) {
  return status.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" ");
}

export function PendingClaimRecoveryPanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  async function search() {
    const value = query.trim();
    if (value.length < 2) { setMessage("Enter at least 2 characters of Employee Code or Employee Name."); setClaims([]); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/pending-claims?q=${encodeURIComponent(value)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) { setClaims([]); setMessage(json.error || "Pending claim search failed."); return; }
      setClaims(json.claims);
      setMessage(json.claims.length ? `${json.claims.length} pending claim(s) found.` : "No pending claims found for this employee search.");
    } catch { setClaims([]); setMessage("Pending claim search failed. Please retry or check server logs."); }
    finally { setBusy(false); }
  }

  async function deleteClaim(claim: PendingClaim) {
    const confirmation = window.prompt(`Permanently delete ${claim.claimId} for ${claim.employeeName}?\n\nThis cannot be undone. Type the Claim ID exactly to confirm.`);
    if (confirmation !== claim.claimId) {
      if (confirmation !== null) setMessage("Claim ID did not match. Nothing was deleted.");
      return;
    }
    setDeletingId(claim.id); setMessage("");
    try {
      const response = await fetch(`/api/admin/pending-claims/${encodeURIComponent(claim.id)}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) { setMessage(json.error || "Claim deletion failed."); return; }
      setClaims((current) => current.filter((item) => item.id !== claim.id));
      setMessage(`${json.deletedClaimId} deleted. The employee can now create and submit a fresh claim.`);
      router.refresh();
    } catch { setMessage("Claim deletion failed. Please retry or check server logs."); }
    finally { setDeletingId(""); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Use only when a submitted claim is stuck because of incorrect workflow mapping. Approved, rejected, returned and paid claims cannot be deleted here.</p>
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="flex-1"><label>Employee Code or Employee Name</label><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} placeholder="Enter at least 2 characters" /></div>
        <button type="button" className="btn" disabled={busy} onClick={search}>{busy ? "Searching..." : "Search Pending Claims"}</button>
      </div>
      {message && <div className="rounded border border-line bg-panel p-2 text-sm">{message}</div>}
      {claims.length > 0 && <div className="overflow-x-auto"><table>
        <thead><tr><th>Claim</th><th>Employee</th><th>Status</th><th>Pending With</th><th>Submitted</th><th>Amount</th><th>Files</th><th>Action</th></tr></thead>
        <tbody>{claims.map((claim) => <tr key={claim.id}>
          <td>{claim.claimId}</td><td>{claim.employeeId} - {claim.employeeName}</td><td>{statusLabel(claim.currentStatus)}</td><td>{claim.currentPendingWith || "-"}</td>
          <td>{claim.submittedAt ? indiaDateTime.format(new Date(claim.submittedAt)) : "-"}</td><td>INR {claim.totalAmount}</td><td>{claim.attachmentCount}</td>
          <td><button type="button" className="btn-secondary" disabled={Boolean(deletingId)} onClick={() => deleteClaim(claim)}>{deletingId === claim.id ? "Deleting..." : "Delete Stuck Claim"}</button></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
  );
}
