export const paymentReportHeaders = ["Claim ID", "Employee ID", "Employee Name", "Approved Amount", "Approval Date", "Paid Date", "Payment Reference", "Payment Remarks"];

type PaymentReportClaim = {
  claimId: string;
  employeeId: string;
  employeeName: string;
  totalAmount: unknown;
  finalApprovedAt: Date | null;
  paidAt?: Date | null;
  paymentReference?: string | null;
  paymentRemarks?: string | null;
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

export function paymentReportRows(claims: PaymentReportClaim[], includePaymentDetails = false) {
  return claims.map((claim) => ({
    "Claim ID": claim.claimId,
    "Employee ID": claim.employeeId,
    "Employee Name": claim.employeeName,
    "Approved Amount": String(claim.totalAmount),
    "Approval Date": claim.finalApprovedAt?.toISOString().slice(0, 10) || "",
    "Paid Date": includePaymentDetails ? claim.paidAt?.toISOString().slice(0, 10) || "" : "",
    "Payment Reference": includePaymentDetails ? claim.paymentReference || "" : "",
    "Payment Remarks": includePaymentDetails ? claim.paymentRemarks || "" : ""
  }));
}
