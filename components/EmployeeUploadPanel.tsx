"use client";

import { useState } from "react";

type PreviewResult = {
  batchId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: { id: string; rowNumber: number; employeeId: string | null; errorMessage: string }[];
};

export function EmployeeUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [defaultPassword, setDefaultPassword] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function postUpload(path: string) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.append("file", file);
    body.append("defaultPassword", defaultPassword);
    const res = await fetch(path, { method: "POST", body });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error || "Upload failed");
      if (json.errors) setPreview({ batchId: "", totalRows: 0, validRows: 0, errorRows: json.errors.length, errors: json.errors });
      return;
    }
    if (path.includes("preview")) setPreview(json);
    else setMessage(`Imported ${json.importedRows} employees.`);
  }

  return (
    <div className="space-y-3">
      <div><a className="btn-secondary" href="/api/employee-upload/template">Download Template</a></div>
      <div><label>Default Password For New Employees</label><input value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} placeholder="Welcome@123" /></div>
      <div><label>Excel/CSV File</label><input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" disabled={!file || busy} onClick={() => postUpload("/api/employee-upload/preview")}>Validate Preview</button>
        <button type="button" className="btn" disabled={!file || busy || !preview || preview.errorRows > 0} onClick={() => postUpload("/api/employee-upload/import")}>Import Valid Records</button>
      </div>
      {message && <div className="rounded border border-line bg-panel p-2 text-sm">{message}</div>}
      {preview && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded border border-line p-2">Valid: <strong>{preview.validRows}</strong></div>
            <div className="rounded border border-line p-2">Errors: <strong>{preview.errorRows}</strong></div>
            <div className="rounded border border-line p-2">Total: <strong>{preview.totalRows}</strong></div>
          </div>
          {preview.errors.length > 0 && <table><thead><tr><th>Row</th><th>Employee ID</th><th>Error</th></tr></thead><tbody>{preview.errors.map((e) => <tr key={`${e.rowNumber}-${e.errorMessage}`}><td>{e.rowNumber}</td><td>{e.employeeId || "-"}</td><td>{e.errorMessage}</td></tr>)}</tbody></table>}
        </div>
      )}
    </div>
  );
}
