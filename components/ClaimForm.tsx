"use client";

import { useState } from "react";
import { claimUploadError } from "@/lib/claimUpload";

export function ClaimForm({ action, children, className }: {
  action: (data: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form action={action} encType="multipart/form-data" className={className}
      onSubmit={(event) => {
        const message = claimUploadError(new FormData(event.currentTarget));
        setError(message);
        if (message) event.preventDefault();
      }}>
      <p className="text-sm text-muted">All attachments and claim details must fit within 10 MB. Please compress receipts before uploading if needed.</p>
      {children}
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </form>
  );
}
