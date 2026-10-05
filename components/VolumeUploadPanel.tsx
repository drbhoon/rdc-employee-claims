"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Preview = {
  batchId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: { rowNumber: number; periodMonth: string; employeeId: string; employeeName: string; designation: string; plant: string; location: string; volumeM3: number }[];
  errors: { id: string; rowNumber: number; employeeId: string | null; periodMonth: string | null; errorMessage: string }[];
};

export function VolumeUploadPanel() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function validate() {
    if (!file) return;
    setBusy(true);
    setMessage("");
    setPreview(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/volume-upload/preview", { method: "POST", body: form });
      const json = await response.json().catch(() => ({ error: "The server returned an unreadable response." }));
      if (!response.ok) {
        setMessage(json.error || "Volume validation failed.");
        return;
      }
      setPreview(json);
      setMessage(json.errorRows ? `Validation found ${json.errorRows} row error(s).` : `${json.validRows} volume row(s) are ready to import.`);
    } catch {
      setMessage("Volume validation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!preview || preview.errorRows || !preview.validRows) return;
    const months = [...new Set(preview.rows.map((row) => row.periodMonth))].join(", ");
    if (!window.confirm(`Importing will replace all previously uploaded volume rows for: ${months}. Continue?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/volume-upload/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: preview.batchId })
      });
      const json = await response.json().catch(() => ({ error: "The server returned an unreadable response." }));
      if (!response.ok) {
        setMessage(json.error || "Volume import failed.");
        return;
      }
      setMessage(`Imported ${json.importedRows} row(s). Replaced volume for ${json.replacedMonths.join(", ")}.`);
      setPreview(null);
      setFile(null);
      router.refresh();
    } catch {
      setMessage("Volume import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a className="btn-secondary" href="/api/volume-upload/template">Download Volume Template</a>
        <span className="text-xs text-muted">Employee designation must contain “Sales”. Volume may be zero but cannot be negative.</span>
      </div>
      <div>
        <label>Completed Excel/CSV File</label>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setMessage(""); }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={!file || busy} onClick={validate}>{busy ? "Working..." : "Validate Preview"}</button>
        <button type="button" className="btn" disabled={busy || !preview || preview.errorRows > 0 || preview.validRows === 0} onClick={importRows}>Import and Replace Uploaded Months</button>
      </div>
      {message && <div className={`rounded border p-2 text-sm ${preview?.errorRows ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-panel"}`}>{message}</div>}
      {preview && (
        <div className="space-y-3">
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded border border-line p-2">Valid: <strong>{preview.validRows}</strong></div>
            <div className="rounded border border-line p-2">Errors: <strong>{preview.errorRows}</strong></div>
            <div className="rounded border border-line p-2">Total: <strong>{preview.totalRows}</strong></div>
          </div>
          {preview.errors.length > 0 && <div className="overflow-x-auto"><table><thead><tr><th>Row</th><th>Month</th><th>Employee</th><th>Error</th></tr></thead><tbody>{preview.errors.map((error) => <tr key={error.id}><td>{error.rowNumber}</td><td>{error.periodMonth || "-"}</td><td>{error.employeeId || "-"}</td><td>{error.errorMessage}</td></tr>)}</tbody></table></div>}
          {preview.rows.length > 0 && <div className="overflow-x-auto"><table><thead><tr><th>Month</th><th>Employee</th><th>Plant</th><th>Location</th><th>Volume m³</th></tr></thead><tbody>{preview.rows.slice(0, 50).map((row) => <tr key={`${row.rowNumber}-${row.employeeId}-${row.plant}`}><td>{row.periodMonth}</td><td>{row.employeeId} - {row.employeeName}</td><td>{row.plant}</td><td>{row.location}</td><td>{row.volumeM3.toFixed(3)}</td></tr>)}</tbody></table>{preview.rows.length > 50 && <p className="mt-2 text-xs text-muted">Showing the first 50 valid rows.</p>}</div>}
        </div>
      )}
    </div>
  );
}
