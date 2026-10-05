import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { periodMonthDate, type ValidatedVolumeRow } from "@/lib/volumeUpload";

function isValidatedRow(value: unknown): value is ValidatedVolumeRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.periodMonth === "string" && typeof row.employeeId === "string" && typeof row.plant === "string" && typeof row.location === "string" && typeof row.volumeM3 === "number";
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Only Superadmin can import volume data." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const batchId = String(body.batchId || "");
  const batch = await prisma.volumeUploadBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.uploadedBy !== user.employeeId) return NextResponse.json({ error: "Volume preview batch was not found." }, { status: 404 });
  if (batch.status !== "PREVIEWED") return NextResponse.json({ error: "This preview batch has already been imported or failed." }, { status: 409 });
  if (batch.errorRows > 0) return NextResponse.json({ error: "Correct all preview errors before importing." }, { status: 400 });
  const rows = Array.isArray(batch.validatedRows) ? batch.validatedRows.filter(isValidatedRow) : [];
  if (!rows.length) return NextResponse.json({ error: "No validated volume rows are available to import." }, { status: 400 });
  const months = [...new Set(rows.map((row) => row.periodMonth))];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.monthlySalesVolume.deleteMany({ where: { periodMonth: { in: months.map(periodMonthDate) } } });
      await tx.monthlySalesVolume.createMany({
        data: rows.map((row) => ({
          periodMonth: periodMonthDate(row.periodMonth),
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          designation: row.designation || null,
          plant: row.plant,
          location: row.location,
          volumeM3: row.volumeM3,
          sourceBatchId: batch.id
        }))
      });
      await tx.volumeUploadBatch.update({
        where: { id: batch.id },
        data: { status: "IMPORTED", importedRows: rows.length, importedAt: new Date() }
      });
    });
  } catch (error) {
    await prisma.volumeUploadBatch.update({ where: { id: batch.id }, data: { status: "FAILED" } });
    console.error("Volume import failed", { batchId, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Volume import failed." }, { status: 409 });
  }
  revalidatePath("/analytics");
  return NextResponse.json({ importedRows: rows.length, replacedMonths: months });
}
