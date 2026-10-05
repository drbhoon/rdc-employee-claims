import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseVolumeUpload, validateVolumeRows } from "@/lib/volumeUpload";

const allowedExtensions = [".xlsx", ".xls", ".csv"];

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Only Superadmin can validate volume uploads." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Choose an Excel or CSV file." }, { status: 400 });
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedExtensions.includes(extension)) return NextResponse.json({ error: "Only XLSX, XLS and CSV files are accepted." }, { status: 400 });
  const maxBytes = Number(process.env.MAX_UPLOAD_SIZE_MB || 5) * 1024 * 1024;
  if (file.size > maxBytes) return NextResponse.json({ error: `File exceeds ${process.env.MAX_UPLOAD_SIZE_MB || 5} MB.` }, { status: 400 });

  const parsed = parseVolumeUpload(Buffer.from(await file.arrayBuffer()));
  if (parsed.headerError) return NextResponse.json({ error: parsed.headerError }, { status: 400 });
  if (!parsed.rows.length) return NextResponse.json({ error: "No volume rows were found below the template headers." }, { status: 400 });
  const { valid, errors } = await validateVolumeRows(parsed.rows);
  const batch = await prisma.volumeUploadBatch.create({
    data: {
      fileName: file.name,
      uploadedBy: user.employeeId,
      totalRows: parsed.rows.length,
      validRows: valid.length,
      errorRows: errors.length,
      validatedRows: valid,
      errors: { create: errors }
    },
    include: { errors: true }
  });
  return NextResponse.json({
    batchId: batch.id,
    totalRows: parsed.rows.length,
    validRows: valid.length,
    errorRows: errors.length,
    rows: valid,
    errors: batch.errors
  });
}
