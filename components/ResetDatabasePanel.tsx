"use client";

import { useState } from "react";

export function ResetDatabasePanel() {
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function resetDatabase() {
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.append("confirm", confirm);
    const res = await fetch("/api/admin/reset-database", { method: "POST", body });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error || "Reset failed");
      return;
    }
    setConfirm("");
    setMessage(`Reset complete. Removed ${json.users} users and ${json.claims} claims. Superadmin, claim types, and approval rules were kept.`);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Clears employees, claims, upload history, reset tokens, and uploaded proof files. Superadmin, claim types, and approval rules remain.</p>
      <div><label>Type RESET To Confirm</label><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      <button type="button" className="btn-secondary" disabled={busy || confirm.toUpperCase() !== "RESET"} onClick={resetDatabase}>Reset Test Data</button>
      {message && <div className="rounded border border-line bg-panel p-2 text-sm">{message}</div>}
    </div>
  );
}
