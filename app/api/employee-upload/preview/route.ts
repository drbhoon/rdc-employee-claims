import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { parseEmployeeUpload, validateRows } from "@/lib/employeeUpload";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Only superadmin can validate employee master uploads." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const rows = parseEmployeeUpload(Buffer.from(await file.arrayBuffer()));
  const { valid, errors } = await validateRows(rows);
  const batch = await prisma.employeeUploadBatch.create({
    data: {
      fileName: file.name,
      uploadedBy: user.employeeId,
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: errors.length,
      errors: { create: errors }
    },
    include: { errors: true }
  });
  return NextResponse.json({ batchId: batch.id, totalRows: rows.length, validRows: valid.length, errorRows: errors.length, errors: batch.errors, rows: valid });
}
