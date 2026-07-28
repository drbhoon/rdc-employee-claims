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

export function PaymentUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      <div><a className="btn-secondary" href="/api/payments/template">Download Claims Awaiting Payment</a></div>
      <p className="text-sm text-muted">This file contains only Final Approved claims not yet marked Paid. Fill Paid Date for claims being paid. Payment Reference and Remarks are optional.</p>
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
