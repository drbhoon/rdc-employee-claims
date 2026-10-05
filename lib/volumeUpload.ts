import * as XLSX from "xlsx";
import { normalizeEmployeeCode } from "@/lib/employeeCode";
import { prisma } from "@/lib/prisma";

export type ParsedVolumeRow = {
  rowNumber: number;
  periodMonth: string;
  employeeId: string;
  plant: string;
  location: string;
  volumeM3: number | null;
};

export type ValidatedVolumeRow = {
  rowNumber: number;
  periodMonth: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  plant: string;
  location: string;
  volumeM3: number;
};

export type VolumeUploadError = {
  rowNumber: number;
  employeeId: string | null;
  periodMonth: string | null;
  errorMessage: string;
};

const requiredHeaders = ["period_month", "employee_code", "plant", "location", "volume_m3"];

function headerKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function cellText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function monthText(rawValue: unknown, formattedValue: unknown) {
  if (rawValue instanceof Date && !Number.isNaN(rawValue.getTime())) {
    return `${rawValue.getFullYear()}-${String(rawValue.getMonth() + 1).padStart(2, "0")}`;
  }
  const text = cellText(formattedValue || rawValue);
  const exact = text.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (exact) return `${exact[1]}-${exact[2].padStart(2, "0")}`;
  const slash = text.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (slash) return `${slash[2]}-${slash[1].padStart(2, "0")}`;
  return text;
}

function numberValue(rawValue: unknown, formattedValue: unknown) {
  if (typeof rawValue === "number") return Number.isFinite(rawValue) ? rawValue : null;
  const text = cellText(formattedValue || rawValue);
  if (!text) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSalesDesignation(value: string | null | undefined) {
  const designation = value || "";
  return /sales/i.test(designation) && !/\bnon[\s-]*sales\b/i.test(designation);
}

export function periodMonthDate(value: string) {
  return new Date(`${value}-01T00:00:00.000Z`);
}

export function parseVolumeUpload(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { rows: [] as ParsedVolumeRow[], headerError: "The workbook does not contain a worksheet." };

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const formattedRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headerIndex = formattedRows.findIndex((row) => {
    const headers = new Set(row.map(headerKey));
    return requiredHeaders.every((header) => headers.has(header));
  });
  if (headerIndex < 0) {
    return { rows: [] as ParsedVolumeRow[], headerError: `Required columns: ${requiredHeaders.join(", ")}. Do not rename the template columns.` };
  }

  const headers = formattedRows[headerIndex].map(headerKey);
  const column = (name: string) => headers.indexOf(name);
  const rows: ParsedVolumeRow[] = [];
  for (let index = headerIndex + 1; index < Math.max(rawRows.length, formattedRows.length); index += 1) {
    const raw = rawRows[index] || [];
    const formatted = formattedRows[index] || [];
    const values = requiredHeaders.map((name) => formatted[column(name)] ?? raw[column(name)]);
    if (values.every((value) => cellText(value) === "")) continue;
    rows.push({
      rowNumber: index + 1,
      periodMonth: monthText(raw[column("period_month")], formatted[column("period_month")]),
      employeeId: normalizeEmployeeCode(formatted[column("employee_code")] || raw[column("employee_code")]),
      plant: cellText(formatted[column("plant")] || raw[column("plant")]),
      location: cellText(formatted[column("location")] || raw[column("location")]),
      volumeM3: numberValue(raw[column("volume_m3")], formatted[column("volume_m3")])
    });
  }
  return { rows, headerError: null as string | null };
}

export async function validateVolumeRows(rows: ParsedVolumeRow[]) {
  const users = await prisma.user.findMany({
    select: { employeeId: true, name: true, designation: true, plant: true, location: true, isActive: true }
  });
  const userByCode = new Map(users.map((user) => [user.employeeId.toLowerCase(), user]));
  const valid: ValidatedVolumeRow[] = [];
  const errors: VolumeUploadError[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const rowErrors: string[] = [];
    const employee = userByCode.get(row.employeeId.toLowerCase());
    const periodMatch = row.periodMonth.match(/^(\d{4})-(\d{2})$/);
    const month = periodMatch ? Number(periodMatch[2]) : 0;
    const plant = row.plant || employee?.plant || "";
    const location = row.location || employee?.location || "";

    if (!periodMatch || month < 1 || month > 12) rowErrors.push("period_month must be YYYY-MM");
    if (!row.employeeId) rowErrors.push("employee_code is required");
    if (!employee) rowErrors.push("employee_code was not found in Employee Master");
    else {
      if (!employee.isActive) rowErrors.push("employee is inactive");
      if (!isSalesDesignation(employee.designation)) rowErrors.push(`designation "${employee.designation || "blank"}" is not recognised as Sales`);
    }
    if (!plant) rowErrors.push("plant is required in the file or Employee Master");
    if (!location) rowErrors.push("location is required in the file or Employee Master");
    if (row.volumeM3 == null || row.volumeM3 < 0) rowErrors.push("volume_m3 must be zero or a positive number");

    const canonicalEmployeeId = employee?.employeeId || row.employeeId;
    const duplicateKey = `${row.periodMonth}|${canonicalEmployeeId.toLowerCase()}|${plant.toLowerCase()}|${location.toLowerCase()}`;
    if (seen.has(duplicateKey)) rowErrors.push("duplicate month, employee, plant and location in this file");
    seen.add(duplicateKey);

    if (rowErrors.length || !employee || row.volumeM3 == null) {
      errors.push({ rowNumber: row.rowNumber, employeeId: row.employeeId || null, periodMonth: row.periodMonth || null, errorMessage: rowErrors.join("; ") });
      continue;
    }
    valid.push({
      rowNumber: row.rowNumber,
      periodMonth: row.periodMonth,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      designation: employee.designation || "",
      plant,
      location,
      volumeM3: row.volumeM3
    });
  }
  return { valid, errors };
}
