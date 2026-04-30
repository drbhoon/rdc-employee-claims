import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { normalizeBool, parseEmployeeUpload, validateRows } from "@/lib/employeeUpload";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file") as File | null;
  const defaultPassword = String(form.get("defaultPassword") || process.env.DEFAULT_EMPLOYEE_PASSWORD || "Welcome@123");
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const rows = parseEmployeeUpload(Buffer.from(await file.arrayBuffer()));
  const { valid, errors } = validateRows(rows);
  if (errors.length) return NextResponse.json({ error: "Fix row errors before import", errors }, { status: 400 });
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  let imported = 0;
  for (const row of valid) {
    await prisma.user.upsert({
      where: { employeeId: String(row.employee_id).trim() },
      create: {
        employeeId: String(row.employee_id).trim(),
        name: String(row.employee_name).trim(),
        email: row.email ? String(row.email).trim() : null,
        mobile: row.mobile ? String(row.mobile).trim() : null,
        passwordHash,
        role: (row.role || "EMPLOYEE") as Role,
        department: row.department || null,
        location: row.location || null,
        plant: row.plant || null,
        costCenter: row.cost_center || null,
        reportingManagerId: row.reporting_manager_id || null,
        level2ApproverId: row.level_2_approver_id || null,
        level3ApproverId: row.level_3_approver_id || null,
        isActive: normalizeBool(row.is_active),
        mustChangePassword: true
      },
      update: {
        name: String(row.employee_name).trim(),
        email: row.email ? String(row.email).trim() : null,
        mobile: row.mobile ? String(row.mobile).trim() : null,
        role: (row.role || "EMPLOYEE") as Role,
        department: row.department || null,
        location: row.location || null,
        plant: row.plant || null,
        costCenter: row.cost_center || null,
        reportingManagerId: row.reporting_manager_id || null,
        level2ApproverId: row.level_2_approver_id || null,
        level3ApproverId: row.level_3_approver_id || null,
        isActive: normalizeBool(row.is_active)
      }
    });
    imported++;
  }
  await prisma.employeeUploadBatch.create({ data: { fileName: file.name, uploadedBy: user.employeeId, totalRows: rows.length, validRows: valid.length, errorRows: 0, importedRows: imported, status: "IMPORTED" } });
  return NextResponse.json({ importedRows: imported });
}
