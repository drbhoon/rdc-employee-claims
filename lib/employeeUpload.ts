import { Role } from "@prisma/client";
import * as XLSX from "xlsx";
import { uploadColumns } from "@/lib/constants";

export type EmployeeUploadRow = {
  employee_id: string;
  employee_name: string;
  email?: string;
  mobile?: string;
  department?: string;
  location?: string;
  plant?: string;
  cost_center?: string;
  reporting_manager_id?: string;
  level_2_approver_id?: string;
  level_3_approver_id?: string;
  role?: Role;
  is_active?: string | boolean;
};

export function parseEmployeeUpload(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<EmployeeUploadRow>(sheet, { defval: "" });
}

export function buildTemplateWorkbook() {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      employee_id: "EMP002",
      employee_name: "Sample Employee",
      email: "employee@example.com",
      mobile: "9999999999",
      department: "Operations",
      location: "Mumbai",
      plant: "Plant A",
      cost_center: "CC100",
      reporting_manager_id: "MGR001",
      level_2_approver_id: "HOD001",
      level_3_approver_id: "DIR001",
      role: "EMPLOYEE",
      is_active: "true"
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

export function validateRows(rows: EmployeeUploadRow[]) {
  const seenEmployees = new Set<string>();
  const seenEmails = new Set<string>();
  const errors: { rowNumber: number; employeeId?: string; errorMessage: string }[] = [];
  const valid = rows.filter((row, idx) => {
    const rowNumber = idx + 2;
    const rowErrors: string[] = [];
    const employeeId = String(row.employee_id || "").trim();
    const email = String(row.email || "").trim();
    const role = String(row.role || "EMPLOYEE").trim();
    if (!employeeId) rowErrors.push("employee_id is required");
    if (!row.employee_name) rowErrors.push("employee_name is required");
    if (employeeId && seenEmployees.has(employeeId)) rowErrors.push("duplicate employee_id in file");
    if (email && seenEmails.has(email)) rowErrors.push("duplicate email in file");
    if (!["EMPLOYEE", "ACCOUNTS", "APPROVER", "ADMIN"].includes(role)) rowErrors.push("role must be EMPLOYEE, ACCOUNTS, APPROVER, or ADMIN");
    if (employeeId) seenEmployees.add(employeeId);
    if (email) seenEmails.add(email);
    if (rowErrors.length) {
      errors.push({ rowNumber, employeeId, errorMessage: rowErrors.join("; ") });
      return false;
    }
    return true;
  });
  return { valid, errors };
}
