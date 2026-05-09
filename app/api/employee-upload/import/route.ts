import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clean, cleanEmail, normalizeBool, parseEmployeeUpload, validateRows } from "@/lib/employeeUpload";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file") as File | null;
  const defaultPassword = String(form.get("defaultPassword") || process.env.DEFAULT_EMPLOYEE_PASSWORD || "Welcome@123");
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const rows = parseEmployeeUpload(Buffer.from(await file.arrayBuffer()));
  const { valid, errors } = await validateRows(rows);
  if (errors.length) return NextResponse.json({ error: "Fix row errors before import", errors }, { status: 400 });
  let imported = 0;
  for (const row of valid) {
    const action = clean(row.action || "ADD").toUpperCase();
    const employeeId = clean(row.employee_id);
    if (action === "DELETE") {
      await prisma.user.update({ where: { employeeId }, data: { isActive: false } });
      imported++;
      continue;
    }

    const password = clean(row.password) || defaultPassword;
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { employeeId },
      create: {
        employeeId,
        name: clean(row.employee_name),
        email: cleanEmail(row.login_id),
        mobile: clean(row.mobile) || null,
        passwordHash,
        role: "EMPLOYEE",
        department: clean(row.department) || null,
        location: clean(row.location) || null,
        plant: clean(row.plant) || null,
        costCenter: clean(row.cost_center) || null,
        accountsName: clean(row.accounts_name),
        accountsEmail: cleanEmail(row.accounts_email),
        rmName: clean(row.rm_name) || null,
        rmEmail: cleanEmail(row.rm_email) || null,
        level1Name: clean(row.level1_name),
        level1Email: cleanEmail(row.level1_email),
        level2Name: clean(row.level2_name),
        level2Email: cleanEmail(row.level2_email),
        isActive: normalizeBool(row.is_active),
        mustChangePassword: true
      },
      update: {
        name: clean(row.employee_name),
        email: cleanEmail(row.login_id),
        mobile: clean(row.mobile) || null,
        role: "EMPLOYEE",
        department: clean(row.department) || null,
        location: clean(row.location) || null,
        plant: clean(row.plant) || null,
        costCenter: clean(row.cost_center) || null,
        accountsName: clean(row.accounts_name),
        accountsEmail: cleanEmail(row.accounts_email),
        rmName: clean(row.rm_name) || null,
        rmEmail: cleanEmail(row.rm_email) || null,
        level1Name: clean(row.level1_name),
        level1Email: cleanEmail(row.level1_email),
        level2Name: clean(row.level2_name),
        level2Email: cleanEmail(row.level2_email),
        isActive: normalizeBool(row.is_active)
      }
    });
    await ensureWorkflowLogin(clean(row.accounts_name), cleanEmail(row.accounts_email), "ACCOUNTS", defaultPassword);
    if (cleanEmail(row.rm_email)) await ensureWorkflowLogin(clean(row.rm_name) || "RM", cleanEmail(row.rm_email), "APPROVER", defaultPassword);
    await ensureWorkflowLogin(clean(row.level1_name), cleanEmail(row.level1_email), "APPROVER", defaultPassword);
    await ensureWorkflowLogin(clean(row.level2_name), cleanEmail(row.level2_email), "APPROVER", defaultPassword);
    imported++;
  }
  await prisma.employeeUploadBatch.create({ data: { fileName: file.name, uploadedBy: user.employeeId, totalRows: rows.length, validRows: valid.length, errorRows: 0, importedRows: imported, status: "IMPORTED" } });
  return NextResponse.json({ importedRows: imported });
}

async function ensureWorkflowLogin(name: string, email: string, role: "ACCOUNTS" | "APPROVER", defaultPassword: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const nextRole =
      existing.role === "ADMIN" || existing.role !== role ? "ADMIN" : role;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: nextRole,
        isActive: true,
        name: existing.role === "EMPLOYEE" ? existing.name : name || existing.name
      }
    });
    return;
  }

  await prisma.user.create({
    data: {
      employeeId: `${role}-${email}`.replace(/[^A-Za-z0-9]/g, "-").slice(0, 40),
      name: name || email,
      email,
      passwordHash: await bcrypt.hash(defaultPassword, 12),
      role,
      department: role === "ACCOUNTS" ? "Finance" : "Approvals",
      isActive: true,
      mustChangePassword: true
    }
  });
}
