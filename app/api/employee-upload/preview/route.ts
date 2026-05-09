import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseEmployeeUpload, validateRows } from "@/lib/employeeUpload";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
