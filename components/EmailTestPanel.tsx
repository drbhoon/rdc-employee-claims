"use client";

import { useState } from "react";

export function EmailTestPanel({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendTest() {
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.append("to", to);
    const res = await fetch("/api/admin/test-email", { method: "POST", body });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(`Failed: ${json.error || "SMTP test failed"}`);
      return;
    }
    const accepted = Array.isArray(json.accepted) ? json.accepted.join(", ") : "";
    const rejected = Array.isArray(json.rejected) ? json.rejected.join(", ") : "";
    setMessage(`Sent. Accepted: ${accepted || "-"}${rejected ? ` Rejected: ${rejected}` : ""}`);
  }

  return (
    <div className="space-y-3">
      <div><label>Send Test Email To</label><input value={to} onChange={(e) => setTo(e.target.value)} type="email" /></div>
      <button type="button" className="btn-secondary" disabled={busy || !to} onClick={sendTest}>Send SMTP Test</button>
      {message && <div className="rounded border border-line bg-panel p-2 text-sm">{message}</div>}
    </div>
  );
}
