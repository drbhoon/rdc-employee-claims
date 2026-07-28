import * as XLSX from "xlsx";

export type PaymentUploadRow = {
  rowNumber: number;
  claimId: string;
  employeeId: string;
  paidDate: string;
  paymentReference: string;
  paymentRemarks: string;
};

export type PaymentUploadRowError = {
  rowNumber: number;
  claimId: string | null;
  employeeId: string | null;
  errorMessage: string;
};

function key(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function isoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) return raw;
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const formatted = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (!Number.isNaN(new Date(`${formatted}T00:00:00Z`).getTime())) return formatted;
  }
  return "";
}

export function parsePaymentUpload(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const rows: PaymentUploadRow[] = [];
  const errors: PaymentUploadRowError[] = [];
  const grouped = new Map<string, PaymentUploadRow>();

  rawRows.forEach((raw, index) => {
    const normalized = Object.fromEntries(Object.entries(raw).map(([header, value]) => [key(header), value]));
    const rowNumber = index + 2;
    const claimId = text(normalized.claim_id);
    const employeeId = text(normalized.employee_id || normalized.employee_code);
    const rawPaidDate = normalized.paid_date || normalized.payment_date;
    const paidDate = isoDate(rawPaidDate);
    const paymentReference = text(normalized.payment_reference || normalized.utr_reference || normalized.utr);
    const paymentRemarks = text(normalized.payment_remarks || normalized.remarks);
    if (!claimId || claimId.toUpperCase() === "SUMMARY" || !text(rawPaidDate)) return;
    const row = { rowNumber, claimId, employeeId, paidDate, paymentReference, paymentRemarks };
    if (!employeeId) errors.push({ rowNumber, claimId, employeeId: null, errorMessage: "Employee ID is required." });
    if (!paidDate) errors.push({ rowNumber, claimId, employeeId: employeeId || null, errorMessage: "Paid Date must be YYYY-MM-DD or DD/MM/YYYY." });
    const existing = grouped.get(claimId.toLowerCase());
    if (existing) {
      if (existing.employeeId !== employeeId || existing.paidDate !== paidDate || existing.paymentReference !== paymentReference || existing.paymentRemarks !== paymentRemarks) {
        errors.push({ rowNumber, claimId, employeeId: employeeId || null, errorMessage: "Duplicate Claim ID has conflicting payment values." });
      }
      return;
    }
    grouped.set(claimId.toLowerCase(), row);
    rows.push(row);
  });
  if (!rows.length && !errors.length) errors.push({ rowNumber: 1, claimId: null, employeeId: null, errorMessage: "No rows contain both Claim ID and Paid Date." });
  return { totalRows: rawRows.length, rows, errors };
}
