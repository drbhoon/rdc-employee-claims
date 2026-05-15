"use client";

import { useState } from "react";

export function SuperadminPasswordResetPanel({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendResetLink() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/superadmin-reset", { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error || "Reset link could not be sent.");
      return;
    }
    setMessage(`Password reset link sent to ${json.email || email}.`);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Send a password reset email to the current superadmin login ID.</p>
      <div className="rounded border border-line bg-panel p-2 text-sm">{email || "No email configured"}</div>
      <button type="button" className="btn-secondary" disabled={busy || !email} onClick={sendResetLink}>
        Send Superadmin Reset Link
      </button>
      {message && <div className="rounded border border-line bg-panel p-2 text-sm">{message}</div>}
    </div>
  );
}
