import { ClaimStatus, Role } from "@prisma/client";
import * as XLSX from "xlsx";
import { uploadColumns } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type EmployeeUploadAction = "ADD" | "UPDATE" | "DELETE";

export type EmployeeUploadRow = {
  action?: EmployeeUploadAction | string;
  employee_id: string;
  employee_name: string;
  login_id?: string;
  password?: string;
  mobile?: string;
  department?: string;
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
  const text = String(value || "").trim();
  return text === "-" ? "" : text;
}

export function cleanEmail(value: unknown) {
  return clean(value).toLowerCase();
}

export function parseEmployeeUpload(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<EmployeeUploadRow>(sheet, { defval: "" });
}

export function buildTemplateWorkbook() {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      action: "ADD",
      employee_id: "EMP002",
      employee_name: "Sample Employee",
      login_id: "employee@example.com",
      password: "Welcome@123",
      mobile: "9999999999",
      department: "Operations",
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
      action: "DELETE",
      employee_id: "EMP003",
      employee_name: "Old Employee",
      login_id: "old.employee@example.com",
      password: "",
      mobile: "",
      department: "",
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

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const rowErrors: string[] = [];
    const employeeId = clean(row.employee_id);
    const action = clean(row.action || "ADD").toUpperCase();
    const loginId = cleanEmail(row.login_id);
    const accountsEmail = cleanEmail(row.accounts_email);
    const rmEmail = cleanEmail(row.rm_email);
    const level1Email = cleanEmail(row.level1_email);
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
    if (!clean(row.level1_name)) rowErrors.push("level1_name is required");
    if (!level1Email) rowErrors.push("level1_email is required");
    if (level1Email && !validEmail(level1Email)) rowErrors.push("level1_email must be a valid email");
    if (!clean(row.level2_name)) rowErrors.push("level2_name is required");
    if (!level2Email) rowErrors.push("level2_email is required");
    if (level2Email && !validEmail(level2Email)) rowErrors.push("level2_email must be a valid email");
    if (employeeId && seenEmployees.has(employeeId)) rowErrors.push("duplicate employee_id in file");
    if (loginId && seenLoginIds.has(loginId)) rowErrors.push("duplicate login_id in file");
    if (!["EMPLOYEE", "ACCOUNTS", "APPROVER", "ADMIN"].includes(role)) rowErrors.push("role must be EMPLOYEE, ACCOUNTS, APPROVER, or ADMIN");

    if (employeeId) seenEmployees.add(employeeId);
    if (loginId) seenLoginIds.add(loginId);
    if (action === "DELETE" && employeeId) deleteIds.push(employeeId);

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
        const rowNumber = rows.findIndex((row) => clean(row.employee_id) === employeeId) + 2;
        errors.push({ rowNumber, employeeId, errorMessage: "DELETE blocked: employee_id does not exist." });
      });
    const openClaims = await prisma.claimHeader.findMany({
      where: { employeeId: { in: deleteIds }, currentStatus: { in: openClaimStatuses } },
      select: { employeeId: true, claimId: true, currentStatus: true }
    });
    openClaims.forEach((claim) => {
      const rowNumber = rows.findIndex((row) => clean(row.employee_id) === claim.employeeId) + 2;
      errors.push({
        rowNumber,
        employeeId: claim.employeeId,
        errorMessage: `DELETE blocked: claim ${claim.claimId} is ${claim.currentStatus}. Pass, reject, or close pending claims before deleting this employee.`
      });
    });
  }

  const blocked = new Set(errors.map((error) => `${error.rowNumber}:${error.employeeId || ""}`));
  return {
    valid: valid.filter((row) => !blocked.has(`${rows.indexOf(row) + 2}:${clean(row.employee_id)}`)),
    errors
  };
}
