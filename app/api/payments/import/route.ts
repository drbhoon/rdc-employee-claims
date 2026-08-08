import { NextResponse } from "next/server";
import { getSession, hasPaymentUploadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PaymentUploadRow } from "@/lib/paymentUpload";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !hasPaymentUploadAccess(user)) return NextResponse.json({ error: "Payment upload permission is required." }, { status: 403 });
  const { batchId } = await request.json();
  const batch = await prisma.paymentUploadBatch.findUnique({ where: { id: String(batchId || "") } });
  if (!batch || batch.uploadedBy !== user.employeeId) return NextResponse.json({ error: "Payment preview batch was not found." }, { status: 404 });
  if (batch.status !== "PREVIEWED") return NextResponse.json({ error: "This payment batch was already processed." }, { status: 409 });
  if (batch.errorRows > 0) return NextResponse.json({ error: "Fix validation errors before importing." }, { status: 400 });
  const rows = (batch.validatedRows || []) as unknown as PaymentUploadRow[];
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const claims = await tx.claimHeader.findMany({ where: { claimId: { in: row.claimIds } } });
        if (claims.length !== row.claimIds.length || claims.some((claim) => claim.employeeId.toLowerCase() !== row.employeeId.toLowerCase() || claim.currentStatus !== "FINAL_APPROVED")) throw new Error(`${row.claimId} changed after preview. Validate a fresh file.`);
        const balance = await tx.employeeAdvanceBalance.findUnique({ where: { employeeId: claims[0].employeeId } });
        if (Number(balance?.balance || 0) !== Number(row.openingAdvanceBalance || 0)) throw new Error(`${row.employeeId}'s advance balance changed after preview. Validate a fresh file.`);
        const paidAt = new Date(`${row.paidDate}T12:00:00.000+05:30`);
        for (const claim of claims) {
          const updated = await tx.claimHeader.updateMany({ where: { id: claim.id, currentStatus: "FINAL_APPROVED" }, data: { currentStatus: "PAID", currentPendingWith: null, paidAt, paymentReference: row.paymentReference || null, paymentRemarks: row.paymentRemarks || null } });
          if (updated.count !== 1) throw new Error(`${claim.claimId} changed after preview. Validate a fresh file.`);
          await tx.claimApprovalHistory.create({ data: { claimHeaderId: claim.id, actionByEmployeeId: user.employeeId, actionByName: user.name, roleAtAction: user.role, action: "PAYMENT_MARKED_PAID", comments: [`Net payable: INR ${Number(row.netPayable || 0).toFixed(2)}`, row.paymentReference && `Reference: ${row.paymentReference}`, row.paymentRemarks].filter(Boolean).join("; "), previousStatus: "FINAL_APPROVED", newStatus: "PAID", actionDate: new Date() } });
        }
        await tx.employeeAdvanceBalance.upsert({ where: { employeeId: claims[0].employeeId }, update: { balance: row.closingAdvanceBalance || 0 }, create: { employeeId: claims[0].employeeId, balance: row.closingAdvanceBalance || 0 } });
      }
      await tx.paymentUploadBatch.update({ where: { id: batch.id }, data: { status: "IMPORTED", importedRows: rows.length, importedAt: new Date() } });
    }, { maxWait: 10000, timeout: 60000 });
    revalidatePath("/payments");
    revalidatePath("/reports");
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    return NextResponse.json({ importedRows: rows.length });
  } catch (error) {
    console.error("Payment batch import failed", { batchId: batch.id, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment import failed." }, { status: 409 });
  }
}
