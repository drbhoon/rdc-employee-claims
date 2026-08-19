import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession, isSuperAdmin, superadminEmail } from "@/lib/auth";
import { clean, cleanEmail, isWorkflowPlaceholderEmployeeId, normalizeEmployeeName, validateRows, type EmployeeUploadRow } from "@/lib/employeeUpload";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { employeeId: string } }) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: "Only superadmin can edit employee master data." }, { status: 403 });
  const employeeId = decodeURIComponent(params.employeeId).trim();
  if (!employeeId || employeeId === "SUPERADMIN" || isWorkflowPlaceholderEmployeeId(employeeId)) return NextResponse.json({ error: "This Employee Code cannot be edited here." }, { status: 400 });
  const body = await request.json();
  const row: EmployeeUploadRow = {
    action: "UPDATE", employee_id: employeeId, employee_name: body.name, login_id: body.email,
    mobile: body.mobile, company: body.company, designation: body.designation, location: body.location,
    plant: body.plant, cost_center: body.costCenter, accounts_name: body.accountsName,
    accounts_email: body.accountsEmail, rm_name: body.rmName, rm_email: body.rmEmail,
    level1_name: body.level1Name, level1_email: body.level1Email, level2_name: body.level2Name,
    level2_email: body.level2Email, role: body.role, is_active: body.isActive
  };
  const existing = await prisma.user.findUnique({ where: { employeeId } });
  if (!existing) return NextResponse.json({ error: "Employee Code was not found." }, { status: 404 });
  const { errors } = await validateRows([row]);
  if (errors.length) return NextResponse.json({ error: errors.map((item) => item.errorMessage).join("; ") }, { status: 400 });
  const email = cleanEmail(row.login_id);
  const role = email === superadminEmail() ? "ADMIN" : clean(row.role || "EMPLOYEE").toUpperCase() as Role;
  const defaultPasswordHash = await bcrypt.hash(process.env.DEFAULT_EMPLOYEE_PASSWORD || "Welcome@123", 12);
  const newPassword = clean(body.password);
  const newPasswordData = newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12), mustChangePassword: true } : {};
  try {
    await prisma.$transaction(async (tx) => {
      const emailOwner = await tx.user.findUnique({ where: { email } });
      if (emailOwner && emailOwner.employeeId !== employeeId && (isWorkflowPlaceholderEmployeeId(emailOwner.employeeId) || normalizeEmployeeName(emailOwner.name) === normalizeEmployeeName(row.employee_name))) {
        await tx.user.update({ where: { id: emailOwner.id }, data: { email: null, isActive: false } });
      }
      await tx.user.update({ where: { employeeId }, data: {
        name: clean(row.employee_name), email, mobile: clean(row.mobile) || null, role,
        company: clean(row.company) || null, designation: clean(row.designation) || null,
        location: clean(row.location) || null, plant: clean(row.plant) || null,
        costCenter: clean(row.cost_center) || null, accountsName: clean(row.accounts_name),
        accountsEmail: cleanEmail(row.accounts_email), rmName: clean(row.rm_name) || null,
        rmEmail: cleanEmail(row.rm_email) || null, level1Name: clean(row.level1_name) || null,
        level1Email: cleanEmail(row.level1_email) || null, level2Name: clean(row.level2_name),
        level2Email: cleanEmail(row.level2_email), isActive: Boolean(body.isActive), ...newPasswordData
      } });
      await ensureWorkflowLogin(tx, clean(row.accounts_name), cleanEmail(row.accounts_email), "ACCOUNTS", defaultPasswordHash);
      if (cleanEmail(row.rm_email)) await ensureWorkflowLogin(tx, clean(row.rm_name) || "RM", cleanEmail(row.rm_email), "APPROVER", defaultPasswordHash);
      if (cleanEmail(row.level1_email)) await ensureWorkflowLogin(tx, clean(row.level1_name), cleanEmail(row.level1_email), "APPROVER", defaultPasswordHash);
      await ensureWorkflowLogin(tx, clean(row.level2_name), cleanEmail(row.level2_email), "APPROVER", defaultPasswordHash);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Employee master edit failed", { employeeId, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Employee update failed." }, { status: 409 });
  }
}

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function ensureWorkflowLogin(tx: Transaction, name: string, email: string, mappedRole: "ACCOUNTS" | "APPROVER", passwordHash: string) {
  const existing = await tx.user.findUnique({ where: { email } });
  if (existing) {
    const role: Role = existing.role === "ADMIN" || existing.role === mappedRole ? existing.role : existing.role === "EMPLOYEE" ? mappedRole : "ADMIN";
    await tx.user.update({ where: { id: existing.id }, data: { role, isActive: true } });
    return;
  }
  await tx.user.create({ data: { employeeId: `${mappedRole}-${email}`.replace(/[^A-Za-z0-9]/g, "-").slice(0, 40), name: name || email, email, passwordHash, role: mappedRole, company: mappedRole === "ACCOUNTS" ? "Finance" : "Approvals", isActive: true, mustChangePassword: true } });
}
