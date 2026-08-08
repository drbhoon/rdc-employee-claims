export const paymentReportHeaders = ["Claim IDs", "Employee ID", "Employee Name", "Reimbursements", "Advances", "Opening Advance Balance", "Net Payable", "Closing Advance Balance", "Approval Date", "Paid Date", "Payment Reference", "Payment Remarks"];

export type PaymentReportClaim = {
  claimId: string;
  employeeId: string;
  employeeName: string;
  totalAmount: unknown;
  finalApprovedAt: Date | null;
  paidAt?: Date | null;
  paymentReference?: string | null;
  paymentRemarks?: string | null;
  lines?: { amount: unknown; claimType: { paymentTreatment: "REIMBURSEMENT" | "EMPLOYEE_ADVANCE" } }[];
};

export type EmployeePaymentRow = {
  claimIds: string[];
  employeeId: string;
  employeeName: string;
  reimbursements: number;
  advances: number;
  openingAdvanceBalance: number;
  netPayable: number;
  closingAdvanceBalance: number;
  approvalDate: string;
};

export function paymentApprovalDateRange(from: string | null | undefined, to: string | null | undefined) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000+05:30`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+05:30`);
  return Object.keys(range).length ? range : undefined;
}

export function invalidPaymentDateRange(from: string | null | undefined, to: string | null | undefined) {
  return Boolean(from && to && from > to);
}

export function paymentPeriodSuffix(from: string | null | undefined, to: string | null | undefined) {
  return from || to ? `-${from || "start"}-to-${to || "latest"}` : "";
}

export function employeePaymentRows(claims: PaymentReportClaim[], balances: Map<string, number>) {
  const grouped = new Map<string, EmployeePaymentRow>();
  for (const claim of claims) {
    const key = claim.employeeId.toLowerCase();
    const row = grouped.get(key) || {
      claimIds: [], employeeId: claim.employeeId, employeeName: claim.employeeName,
      reimbursements: 0, advances: 0, openingAdvanceBalance: balances.get(key) || 0,
      netPayable: 0, closingAdvanceBalance: 0, approvalDate: ""
    };
    row.claimIds.push(claim.claimId);
    for (const line of claim.lines || []) {
      const amount = Number(line.amount);
      if (line.claimType.paymentTreatment === "EMPLOYEE_ADVANCE") row.advances += amount;
      else row.reimbursements += amount;
    }
    const date = claim.finalApprovedAt?.toISOString().slice(0, 10) || "";
    if (date > row.approvalDate) row.approvalDate = date;
    grouped.set(key, row);
  }
  return [...grouped.values()].map((row) => {
    const currentNet = row.reimbursements - row.advances;
    row.netPayable = Math.max(currentNet - row.openingAdvanceBalance, 0);
    row.closingAdvanceBalance = Math.max(row.openingAdvanceBalance - currentNet, 0);
    return row;
  });
}

export function paymentReportRows(rows: EmployeePaymentRow[]) {
  return rows.map((row) => ({
    "Claim IDs": row.claimIds.join("; "),
    "Employee ID": row.employeeId,
    "Employee Name": row.employeeName,
    "Reimbursements": row.reimbursements.toFixed(2),
    "Advances": (-row.advances).toFixed(2),
    "Opening Advance Balance": (-row.openingAdvanceBalance).toFixed(2),
    "Net Payable": row.netPayable.toFixed(2),
    "Closing Advance Balance": (-row.closingAdvanceBalance).toFixed(2),
    "Approval Date": row.approvalDate,
    "Paid Date": "",
    "Payment Reference": "",
    "Payment Remarks": ""
  }));
}
