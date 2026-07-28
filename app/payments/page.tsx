import { PaymentUploadPanel } from "@/components/PaymentUploadPanel";
import { Shell } from "@/components/Shell";
import { requirePaymentUploader } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function PaymentsPage() {
  await requirePaymentUploader();
  const batches = await prisma.paymentUploadBatch.findMany({ orderBy: { uploadedAt: "desc" }, take: 10 });
  return <Shell title="Payment Status Upload"><div className="space-y-4"><section className="card"><PaymentUploadPanel /></section><section className="card"><h2 className="mb-3 font-semibold">Recent Payment Uploads</h2><table><thead><tr><th>Date</th><th>File</th><th>Valid</th><th>Errors</th><th>Imported</th><th>Status</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td>{batch.uploadedAt.toLocaleString("en-IN")}</td><td>{batch.fileName}</td><td>{batch.validRows}</td><td>{batch.errorRows}</td><td>{batch.importedRows}</td><td>{batch.status}</td></tr>)}{!batches.length && <tr><td colSpan={6} className="text-center text-muted">No payment uploads yet.</td></tr>}</tbody></table></section></div></Shell>;
}
