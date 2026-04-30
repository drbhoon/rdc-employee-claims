import { statusLabel } from "@/lib/workflow";

export function StatusBadge({ status }: { status: string }) {
  const color = status.includes("REJECTED")
    ? "border-red-200 bg-red-50 text-red-700"
    : status.includes("APPROVED") || status === "PAID"
      ? "border-green-200 bg-green-50 text-green-700"
      : status.includes("PENDING") || status.includes("SUBMITTED")
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${color}`}>{statusLabel(status)}</span>;
}
