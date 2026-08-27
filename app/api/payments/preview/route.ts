import { NextResponse } from "next/server";
import { getSession, hasPaymentUploadAccess } from "@/lib/auth";
import { parsePaymentUpload, type PaymentUploadRowError } from "@/lib/paymentUpload";
import { prisma } from "@/lib/prisma";
import { employeePaymentRows } from "@/lib/paymentReport";

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
  const includedClaimIds = new Set<string>();
  for (const row of parsed.rows) {
    const repeated = row.claimIds.find((id) => includedClaimIds.has(id.toLowerCase()));
    if (repeated) {
      errors.push({ rowNumber: row.rowNumber, claimId: repeated, employeeId: row.employeeId, errorMessage: "Claim ID appears in more than one payment row." });
      continue;
    }
    row.claimIds.forEach((id) => includedClaimIds.add(id.toLowerCase()));
    const claims = await prisma.claimHeader.findMany({ where: { claimId: { in: row.claimIds } }, include: { lines: { include: { claimType: true } } } });
    const missing = row.claimIds.filter((id) => !claims.some((claim) => claim.claimId.toLowerCase() === id.toLowerCase()));
    const invalid = claims.find((claim) => claim.employeeId.toLowerCase() !== row.employeeId.toLowerCase() || claim.currentStatus !== "FINAL_APPROVED");
    if (missing.length) errors.push({ rowNumber: row.rowNumber, claimId: row.claimId, employeeId: row.employeeId, errorMessage: `Claim ID(s) not found: ${missing.join(", ")}.` });
    else if (invalid) errors.push({ rowNumber: row.rowNumber, claimId: invalid.claimId, employeeId: row.employeeId, errorMessage: invalid.employeeId.toLowerCase() !== row.employeeId.toLowerCase() ? `Employee Code does not match claim owner ${invalid.employeeId}.` : `Only Final Approved claims can be settled; current status is ${invalid.currentStatus}.` });
    else {
      const balance = await prisma.employeeAdvanceBalance.findUnique({ where: { employeeId: claims[0].employeeId } });
      const calculated = employeePaymentRows(claims, new Map([[row.employeeId.toLowerCase(), Number(balance?.balance || 0)]]))[0];
      valid.push({ ...row, openingAdvanceBalance: calculated.openingAdvanceBalance, netPayable: calculated.netPayable, closingAdvanceBalance: calculated.closingAdvanceBalance });
    }
  }
  const batch = await prisma.paymentUploadBatch.create({ data: { fileName: file.name, uploadedBy: user.employeeId, totalRows: parsed.totalRows, validRows: valid.length, errorRows: errors.length, validatedRows: valid, errors: { create: errors } }, include: { errors: true } });
  return NextResponse.json({ batchId: batch.id, totalRows: parsed.totalRows, validRows: valid.length, errorRows: errors.length, errors: batch.errors, rows: valid });
}
