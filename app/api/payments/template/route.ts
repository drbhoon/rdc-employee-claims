import { csvResponse } from "@/lib/csv";
import { getSession, hasPaymentUploadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const paymentFileHeaders = ["Claim ID", "Employee ID", "Employee Name", "Approved Amount", "Approval Date", "Paid Date", "Payment Reference", "Payment Remarks"];

export async function GET() {
  const user = await getSession();
  if (!user || !hasPaymentUploadAccess(user)) return new Response("Unauthorized", { status: 401 });
  const claims = await prisma.claimHeader.findMany({ where: { currentStatus: "FINAL_APPROVED" }, orderBy: { finalApprovedAt: "asc" } });
  const rows = claims.map((claim) => ({ "Claim ID": claim.claimId, "Employee ID": claim.employeeId, "Employee Name": claim.employeeName, "Approved Amount": String(claim.totalAmount), "Approval Date": claim.finalApprovedAt?.toISOString().slice(0, 10) || "", "Paid Date": "", "Payment Reference": "", "Payment Remarks": "" }));
  return csvResponse("claims-awaiting-payment.csv", rows, paymentFileHeaders);
}
