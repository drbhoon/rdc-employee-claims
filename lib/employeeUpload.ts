import { ClaimStatus, Role } from "@prisma/client";
import * as XLSX from "xlsx";
import { uploadColumns } from "@/lib/constants";
import { normalizeEmployeeCode } from "@/lib/employeeCode";
import { prisma } from "@/lib/prisma";

export type EmployeeUploadAction = "ADD" | "UPDATE" | "DELETE";

export type EmployeeUploadRow = {
  action?: EmployeeUploadAction | string;
  employee_id: string;
  employee_name: string;
  login_id?: string;
  password?: string;
  mobile?: string;
  company?: string;
  designation?: string;
  location?: string;
  plant?: string;
  cost_center?: string;
  accounts_name?: string;
  accounts_email?: string;
  rm_name?: string;
  rm_email?: string;
  level1_name?: string;
  level1_email?: string;
  level2_name?: string;
  level2_email?: string;
  role?: Role;
  is_active?: string | boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const openClaimStatuses: ClaimStatus[] = [
  "DRAFT",
  "SUBMITTED_TO_ACCOUNTS",
  "RETURNED_BY_ACCOUNTS",
  "PASSED_BY_ACCOUNTS",
  "PENDING_LEVEL_1_APPROVAL",
  "PENDING_LEVEL_2_APPROVAL",
  "PENDING_LEVEL_3_APPROVAL",
  "FINAL_APPROVED",
  "PAYMENT_DOWNLOADED"
];

export function clean(value: unknown) {
  const text = value == null ? "" : String(value).trim();
  return text === "-" ? "" : text;
}

export function cleanEmail(value: unknown) {
  return clean(value).toLowerCase();
}

export function parseEmployeeUpload(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Employee Codes are identifiers. Formatted text preserves leading zeroes
  // from Excel cells instead of coercing numeric-looking codes to numbers.
  return XLSX.utils.sheet_to_json<EmployeeUploadRow>(sheet, { defval: "", raw: false }).filter(isMeaningfulUploadRow);
}

export function buildTemplateWorkbook() {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      action: "ADD",
      employee_id: "001234",
      employee_name: "Sample Employee",
      login_id: "employee@example.com",
      password: "Welcome@123",
      mobile: "9999999999",
      company: "RDC Concrete India Pvt Ltd",
      designation: "Sales Executive",
      location: "Mumbai",
      plant: "Plant A",
      cost_center: "CC100",
      accounts_name: "Accounts Verifier",
      accounts_email: "accounts@example.com",
      rm_name: "Reporting Manager",
      rm_email: "rm@example.com",
      level1_name: "Level1 Approver",
      level1_email: "level1@example.com",
      level2_name: "Level2 Approver",
      level2_email: "level2@example.com",
      role: "EMPLOYEE",
      is_active: "true"
    },
    {
      action: "UPDATE",
      employee_id: "001234",
      employee_name: "Sample Employee Updated",
      login_id: "employee@example.com",
      password: "",
      mobile: "8888888888",
      company: "RDC Concrete India Pvt Ltd",
      designation: "Senior Sales Executive",
      location: "Delhi",
      plant: "Plant B",
      cost_center: "CC200",
      accounts_name: "Accounts Verifier",
      accounts_email: "accounts@example.com",
      rm_name: "New Reporting Manager",
      rm_email: "new.rm@example.com",
      level1_name: "",
      level1_email: "",
      level2_name: "New Level2 Approver",
      level2_email: "new.level2@example.com",
      role: "EMPLOYEE",
      is_active: "true"
    },
    {
      action: "DELETE",
      employee_id: "EMP003",
      employee_name: "Old Employee",
      login_id: "old.employee@example.com",
      password: "",
      mobile: "",
      company: "",
      designation: "",
      location: "",
      plant: "",
      cost_center: "",
      accounts_name: "Accounts Verifier",
      accounts_email: "accounts@example.com",
      rm_name: "-",
      rm_email: "-",
      level1_name: "Level1 Approver",
      level1_email: "level1@example.com",
      level2_name: "Level2 Approver",
      level2_email: "level2@example.com",
      role: "EMPLOYEE",
      is_active: "false"
    }
  ], { header: uploadColumns });
  const employeeCodeColumn = uploadColumns.indexOf("employee_id");
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    const address = XLSX.utils.encode_cell({ r: row, c: employeeCodeColumn });
    if (worksheet[address]) {
      worksheet[address].t = "s";
      worksheet[address].z = "@";
    }
  }
  worksheet["!cols"] = uploadColumns.map((column) => ({ wch: column === "employee_id" ? 20 : 24 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "employees");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function normalizeBool(value: unknown) {
  if (typeof value === "boolean") return value;
  return String(value || "true").trim().toLowerCase() !== "false";
}

function validEmail(value: string) {
  return emailPattern.test(value);
}

export async function validateRows(rows: EmployeeUploadRow[]) {
  const seenEmployees = new Set<string>();
  const seenLoginIds = new Set<string>();
  const errors: { rowNumber: number; employeeId?: string; errorMessage: string }[] = [];
  const valid: EmployeeUploadRow[] = [];
  const deleteIds: string[] = [];
  const loginRows: { rowNumber: number; employeeId: string; employeeName: string; loginId: string }[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const rowErrors: string[] = [];
    const employeeId = normalizeEmployeeCode(row.employee_id);
    const action = clean(row.action || "ADD").toUpperCase();
    const loginId = cleanEmail(row.login_id);
    const accountsEmail = cleanEmail(row.accounts_email);
    const rmEmail = cleanEmail(row.rm_email);
    const level1Name = clean(row.level1_name);
    const level1Email = cleanEmail(row.level1_email);
    const level2Name = clean(row.level2_name);
    const level2Email = cleanEmail(row.level2_email);
    const role = clean(row.role || "EMPLOYEE").toUpperCase();

    if (!["ADD", "UPDATE", "DELETE"].includes(action)) rowErrors.push("action must be ADD, UPDATE, or DELETE");
    if (!employeeId) rowErrors.push("employee_id is required");
    if (employeeId.toUpperCase() === "SUPERADMIN") rowErrors.push("SUPERADMIN is reserved and cannot be added, updated, or deleted by employee upload");
    if (action !== "DELETE" && !clean(row.employee_name)) rowErrors.push("employee_name is required");
    if (!loginId) rowErrors.push("login_id is required");
    if (loginId && !validEmail(loginId)) rowErrors.push("login_id must be a valid email");
    if (!clean(row.accounts_name)) rowErrors.push("accounts_name is required");
    if (!accountsEmail) rowErrors.push("accounts_email is required");
    if (accountsEmail && !validEmail(accountsEmail)) rowErrors.push("accounts_email must be a valid email");
    if (rmEmail && !validEmail(rmEmail)) rowErrors.push("rm_email must be a valid email or '-'");
    if ((level1Name || level1Email) && !level1Name) rowErrors.push("level1_name is required when level1_email is provided");
    if ((level1Name || level1Email) && !level1Email) rowErrors.push("level1_email is required when level1_name is provided");
    if (level1Email && !validEmail(level1Email)) rowErrors.push("level1_email must be a valid email");
    if (!level2Name) rowErrors.push("level2_name is required");
    if (!level2Email) rowErrors.push("level2_email is required");
    if (level2Email && !validEmail(level2Email)) rowErrors.push("level2_email must be a valid email");
    if (employeeId && seenEmployees.has(employeeId)) rowErrors.push("duplicate employee_id in file");
    if (loginId && seenLoginIds.has(loginId)) rowErrors.push("duplicate login_id in file");
    if (!["EMPLOYEE", "ACCOUNTS", "APPROVER", "ADMIN"].includes(role)) rowErrors.push("role must be EMPLOYEE, ACCOUNTS, APPROVER, or ADMIN");

    if (employeeId) seenEmployees.add(employeeId);
    if (loginId) seenLoginIds.add(loginId);
    if (action === "DELETE" && employeeId) deleteIds.push(employeeId);
    if (employeeId && loginId && action !== "DELETE") loginRows.push({ rowNumber, employeeId, employeeName: clean(row.employee_name), loginId });

    if (rowErrors.length) errors.push({ rowNumber, employeeId, errorMessage: rowErrors.join("; ") });
    else valid.push(row);
  });

  if (deleteIds.length) {
    const existingDeleteUsers = await prisma.user.findMany({
      where: { employeeId: { in: deleteIds } },
      select: { employeeId: true }
    });
    const existingDeleteIds = new Set(existingDeleteUsers.map((item) => item.employeeId));
    deleteIds
      .filter((employeeId) => !existingDeleteIds.has(employeeId))
      .forEach((employeeId) => {
        const rowNumber = rows.findIndex((row) => normalizeEmployeeCode(row.employee_id) === employeeId) + 2;
        errors.push({ rowNumber, employeeId, errorMessage: "DELETE blocked: employee_id does not exist." });
      });
    const openClaims = await prisma.claimHeader.findMany({
      where: { employeeId: { in: deleteIds }, currentStatus: { in: openClaimStatuses } },
      select: { employeeId: true, claimId: true, currentStatus: true }
    });
    openClaims.forEach((claim) => {
      const rowNumber = rows.findIndex((row) => normalizeEmployeeCode(row.employee_id) === claim.employeeId) + 2;
      errors.push({
        rowNumber,
        employeeId: claim.employeeId,
        errorMessage: `DELETE blocked: claim ${claim.claimId} is ${claim.currentStatus}. Pass, reject, or close pending claims before deleting this employee.`
      });
    });
  }

  if (loginRows.length) {
    const existingLoginUsers = await prisma.user.findMany({
      where: { email: { in: loginRows.map((row) => row.loginId) } },
      select: { employeeId: true, email: true, name: true }
    });
    const ownerByEmail = new Map(existingLoginUsers.map((user) => [user.email?.toLowerCase(), user]));
    loginRows.forEach((row) => {
      const owner = ownerByEmail.get(row.loginId);
      if (
        owner &&
        owner.employeeId !== row.employeeId &&
        owner.employeeId !== "SUPERADMIN" &&
        !isWorkflowPlaceholderEmployeeId(owner.employeeId) &&
        normalizeEmployeeName(owner.name) !== normalizeEmployeeName(row.employeeName)
      ) {
        errors.push({
          rowNumber: row.rowNumber,
          employeeId: row.employeeId,
          errorMessage: `login_id already belongs to employee_id ${owner.employeeId} with a different employee name.`
        });
      }
    });
  }

  const blocked = new Set(errors.map((error) => `${error.rowNumber}:${error.employeeId || ""}`));
  return {
    valid: valid.filter((row) => !blocked.has(`${rows.indexOf(row) + 2}:${normalizeEmployeeCode(row.employee_id)}`)),
    errors
  };
}

export function normalizeEmployeeName(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isWorkflowPlaceholderEmployeeId(employeeId: string) {
  return employeeId.startsWith("APPROVER-") || employeeId.startsWith("ACCOUNTS-");
}

function isMeaningfulUploadRow(row: EmployeeUploadRow) {
  return uploadColumns.some((column) => clean(row[column as keyof EmployeeUploadRow]).length > 0);
}
