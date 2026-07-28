import { NextResponse } from "next/server";
import { getSession, hasPaymentUploadAccess } from "@/lib/auth";
import { parsePaymentUpload, type PaymentUploadRowError } from "@/lib/paymentUpload";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !hasPaymentUploadAccess(user)) return NextResponse.json({ error: "Payment upload permission is required." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Select a CSV or Excel file." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Payment file must be 10 MB or smaller." }, { status: 400 });
  let parsed;
  try { parsed = parsePaymentUpload(Buffer.from(await file.arrayBuffer())); }
  catch { return NextResponse.json({ error: "Unable to read the file. Use the downloaded CSV or an Excel workbook." }, { status: 400 }); }
  const errors: PaymentUploadRowError[] = [...parsed.errors];
  const valid = [];
  for (const row of parsed.rows) {
    const claim = await prisma.claimHeader.findUnique({ where: { claimId: row.claimId }, select: { employeeId: true, currentStatus: true } });
    if (!claim) errors.push({ rowNumber: row.rowNumber, claimId: row.claimId, employeeId: row.employeeId, errorMessage: "Claim ID was not found." });
    else if (claim.employeeId.toLowerCase() !== row.employeeId.toLowerCase()) errors.push({ rowNumber: row.rowNumber, claimId: row.claimId, employeeId: row.employeeId, errorMessage: `Employee ID does not match claim owner ${claim.employeeId}.` });
    else if (claim.currentStatus === "PAID") errors.push({ rowNumber: row.rowNumber, claimId: row.claimId, employeeId: row.employeeId, errorMessage: "Claim is already Paid." });
    else if (claim.currentStatus !== "FINAL_APPROVED") errors.push({ rowNumber: row.rowNumber, claimId: row.claimId, employeeId: row.employeeId, errorMessage: `Only Final Approved claims can be paid; current status is ${claim.currentStatus}.` });
    else valid.push(row);
  }
  const batch = await prisma.paymentUploadBatch.create({ data: { fileName: file.name, uploadedBy: user.employeeId, totalRows: parsed.totalRows, validRows: valid.length, errorRows: errors.length, validatedRows: valid, errors: { create: errors } }, include: { errors: true } });
  return NextResponse.json({ batchId: batch.id, totalRows: parsed.totalRows, validRows: valid.length, errorRows: errors.length, errors: batch.errors, rows: valid });
}
