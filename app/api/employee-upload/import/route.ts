import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession, isSuperAdmin, superadminEmail } from "@/lib/auth";
import { clean, cleanEmail, isWorkflowPlaceholderEmployeeId, normalizeBool, normalizeEmployeeName, parseEmployeeUpload, validateRows, type EmployeeUploadRow } from "@/lib/employeeUpload";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let currentRow = 0;
  let currentEmployeeId = "";
  try {
    const user = await getSession();
    if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Only superadmin can import employee master data." }, { status: 403 });
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const defaultPassword = String(form.get("defaultPassword") || process.env.DEFAULT_EMPLOYEE_PASSWORD || "Welcome@123");
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    const rows = parseEmployeeUpload(Buffer.from(await file.arrayBuffer()));
    const { valid, errors } = await validateRows(rows);
    if (errors.length) return NextResponse.json({ error: "Fix row errors before import", errors }, { status: 400 });

    const defaultPasswordHash = await bcrypt.hash(defaultPassword, 12);
    let imported = 0;
    const workflowRows: EmployeeUploadRow[] = [];

    for (const [index, row] of valid.entries()) {
      currentRow = rows.indexOf(row) + 2 || index + 2;
      const action = clean(row.action || "ADD").toUpperCase();
      const employeeId = clean(row.employee_id);
      currentEmployeeId = employeeId;
      if (action === "DELETE") {
        await prisma.user.update({ where: { employeeId }, data: { isActive: false } });
        imported++;
        continue;
      }

      const loginId = cleanEmail(row.login_id);
      const transferredLogin = await releaseReusableLogin(loginId, employeeId, clean(row.employee_name));
      const rowPassword = clean(row.password);
      const passwordHash = rowPassword ? await bcrypt.hash(rowPassword, 12) : transferredLogin?.passwordHash || defaultPasswordHash;
      const role = uploadRole(row, loginId);
      const baseData = employeeData(row, role, loginId);
      const updateData = rowPassword ? { ...baseData, passwordHash, mustChangePassword: true } : transferredLogin ? { ...baseData, passwordHash, mustChangePassword: transferredLogin.mustChangePassword } : baseData;
      await prisma.user.upsert({
        where: { employeeId },
        create: {
          employeeId,
          ...baseData,
          passwordHash,
          mustChangePassword: rowPassword ? true : transferredLogin?.mustChangePassword ?? true
        },
        update: updateData
      });
      workflowRows.push(row);
      imported++;
    }

    for (const [index, row] of workflowRows.entries()) {
      currentRow = rows.indexOf(row) + 2 || index + 2;
      currentEmployeeId = clean(row.employee_id);
      await ensureWorkflowLogin(clean(row.accounts_name), cleanEmail(row.accounts_email), "ACCOUNTS", defaultPasswordHash);
      if (cleanEmail(row.rm_email)) await ensureWorkflowLogin(clean(row.rm_name) || "RM", cleanEmail(row.rm_email), "APPROVER", defaultPasswordHash);
      if (cleanEmail(row.level1_email)) await ensureWorkflowLogin(clean(row.level1_name), cleanEmail(row.level1_email), "APPROVER", defaultPasswordHash);
      await ensureWorkflowLogin(clean(row.level2_name), cleanEmail(row.level2_email), "APPROVER", defaultPasswordHash);
    }

    await prisma.employeeUploadBatch.create({ data: { fileName: file.name, uploadedBy: user.employeeId, totalRows: rows.length, validRows: valid.length, errorRows: 0, importedRows: imported, status: "IMPORTED" } });
    return NextResponse.json({ importedRows: imported });
  } catch (error) {
    console.error("Employee import failed", { rowNumber: currentRow, employeeId: currentEmployeeId, error });
    return NextResponse.json({
      error: `Import failed at row ${currentRow || "unknown"}${currentEmployeeId ? ` for employee ${currentEmployeeId}` : ""}: ${errorMessage(error)}`
    }, { status: 500 });
  }
}

function uploadRole(row: EmployeeUploadRow, loginId: string): Role {
  if (loginId === superadminEmail()) return "ADMIN";
  return clean(row.role || "EMPLOYEE").toUpperCase() as Role;
}

function employeeData(row: EmployeeUploadRow, role: Role, loginId: string) {
  return {
    name: clean(row.employee_name),
    email: loginId,
    mobile: clean(row.mobile) || null,
    role,
    company: clean(row.company) || null,
    designation: clean(row.designation) || null,
    location: clean(row.location) || null,
    plant: clean(row.plant) || null,
    costCenter: clean(row.cost_center) || null,
    accountsName: clean(row.accounts_name),
    accountsEmail: cleanEmail(row.accounts_email),
    rmName: clean(row.rm_name) || null,
    rmEmail: cleanEmail(row.rm_email) || null,
    level1Name: clean(row.level1_name) || null,
    level1Email: cleanEmail(row.level1_email) || null,
    level2Name: clean(row.level2_name),
    level2Email: cleanEmail(row.level2_email),
    isActive: normalizeBool(row.is_active)
  };
}

async function releaseReusableLogin(email: string, employeeId: string, employeeName: string) {
  if (!email || employeeId === "SUPERADMIN") return;
  const owner = await prisma.user.findUnique({ where: { email } });
  if (!owner || owner.employeeId === employeeId) return;
  const isPlaceholder = isWorkflowPlaceholderEmployeeId(owner.employeeId);
  if (owner.employeeId === "SUPERADMIN") return;
  if (!isPlaceholder && normalizeEmployeeName(owner.name) !== normalizeEmployeeName(employeeName)) return;

  const targetEmployee = await prisma.user.findUnique({ where: { employeeId } });
  const fallbackClaimCount = await prisma.claimHeader.count({ where: { employeeId: owner.employeeId } });
  if (!targetEmployee && fallbackClaimCount === 0) {
    await prisma.user.update({
      where: { id: owner.id },
      data: { employeeId }
    });
    return { passwordHash: owner.passwordHash, mustChangePassword: owner.mustChangePassword };
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      email: null,
      isActive: false
    }
  });
  return { passwordHash: owner.passwordHash, mustChangePassword: owner.mustChangePassword };
}

async function ensureWorkflowLogin(name: string, email: string, role: "ACCOUNTS" | "APPROVER", defaultPasswordHash: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: mergeWorkflowRole(existing.role, role),
        isActive: true
      }
    });
    return;
  }

  await prisma.user.create({
    data: {
      employeeId: `${role}-${email}`.replace(/[^A-Za-z0-9]/g, "-").slice(0, 40),
      name: name || email,
      email,
      passwordHash: defaultPasswordHash,
      role,
      company: role === "ACCOUNTS" ? "Finance" : "Approvals",
      isActive: true,
      mustChangePassword: true
    }
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function mergeWorkflowRole(existingRole: Role, mappedRole: "ACCOUNTS" | "APPROVER"): Role {
  if (existingRole === "ADMIN" || existingRole === mappedRole) return existingRole;
  if (existingRole === "EMPLOYEE") return mappedRole;
  return "ADMIN";
}
