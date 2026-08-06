"use client";

import { useState } from "react";

type Preview = {
  batchId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: { rowNumber: number; claimId: string | null; employeeId: string | null; errorMessage: string }[];
  rows: { rowNumber: number; claimId: string; employeeId: string; paidDate: string; paymentReference: string }[];
};

export function PaymentUploadPanel({ from, to }: { from?: string; to?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const invalidDateRange = Boolean(from && to && from > to);
  const downloadQuery = new URLSearchParams();
  if (from) downloadQuery.set("from", from);
  if (to) downloadQuery.set("to", to);
  const downloadHref = `/api/payments/template${downloadQuery.size ? `?${downloadQuery.toString()}` : ""}`;

  async function validate() {
    if (!file) return;
    setBusy(true); setMessage(""); setPreview(null);
    const body = new FormData(); body.append("file", file);
    try {
      const response = await fetch("/api/payments/preview", { method: "POST", body });
      const json = await response.json();
      if (!response.ok) return setMessage(json.error || "Validation failed.");
      setPreview(json);
      setMessage(json.errorRows ? `Validation found ${json.errorRows} error(s). Nothing has been updated.` : `${json.validRows} claim(s) are ready to mark Paid.`);
    } catch { setMessage("Validation failed. Please retry or check server logs."); }
    finally { setBusy(false); }
  }

  async function apply() {
    if (!preview || preview.errorRows) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/payments/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: preview.batchId }) });
      const json = await response.json();
      if (!response.ok) return setMessage(json.error || "Payment update failed.");
      setMessage(`${json.importedRows} claim(s) marked Paid successfully.`); setPreview(null); setFile(null);
    } catch { setMessage("Payment update failed. Please retry or check server logs."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <form action="/payments" className="grid gap-3 md:grid-cols-4">
        <div><label>From Approval Date</label><input type="date" name="from" defaultValue={from || ""} /></div>
        <div><label>To Approval Date</label><input type="date" name="to" defaultValue={to || ""} /></div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2"><button className="btn" type="submit">Apply Dates</button><a className="btn-secondary" href="/payments">Clear</a>{!invalidDateRange && <a className="btn-secondary" href={downloadHref}>Download Claims Awaiting Payment</a>}</div>
      </form>
      {invalidDateRange && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">From date cannot be after To date.</div>}
      <p className="text-sm text-muted">This Claim ID-wise file contains only Final Approved claims not yet marked Paid within the selected approval-date period. Fill Paid Date for claims being paid. Payment Reference and Remarks are optional.</p>
      <div><label>Completed CSV/Excel File</label><input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setMessage(""); }} /></div>
      <div className="flex gap-2"><button className="btn-secondary" type="button" disabled={!file || busy} onClick={validate}>Validate Preview</button><button className="btn" type="button" disabled={!preview || preview.errorRows > 0 || busy} onClick={apply}>Mark Valid Claims Paid</button></div>
      {message && <div className="rounded border border-line bg-panel p-2 text-sm">{message}</div>}
      {preview && <div className="space-y-2"><div className="grid grid-cols-3 gap-2 text-sm"><div className="rounded border p-2">Valid: <strong>{preview.validRows}</strong></div><div className="rounded border p-2">Errors: <strong>{preview.errorRows}</strong></div><div className="rounded border p-2">File rows: <strong>{preview.totalRows}</strong></div></div>
        {preview.rows.length > 0 && <table><thead><tr><th>Row</th><th>Claim</th><th>Employee</th><th>Paid Date</th><th>Reference</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.claimId}><td>{row.rowNumber}</td><td>{row.claimId}</td><td>{row.employeeId}</td><td>{row.paidDate}</td><td>{row.paymentReference || "-"}</td></tr>)}</tbody></table>}
        {preview.errors.length > 0 && <table><thead><tr><th>Row</th><th>Claim</th><th>Employee</th><th>Error</th></tr></thead><tbody>{preview.errors.map((error) => <tr key={`${error.rowNumber}-${error.errorMessage}`}><td>{error.rowNumber}</td><td>{error.claimId || "-"}</td><td>{error.employeeId || "-"}</td><td>{error.errorMessage}</td></tr>)}</tbody></table>}
      </div>}
    </div>
  );
}
