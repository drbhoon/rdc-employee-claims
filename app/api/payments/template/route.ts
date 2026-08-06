import { csvResponse } from "@/lib/csv";
import { getSession, hasPaymentUploadAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidPaymentDateRange, paymentApprovalDateRange, paymentPeriodSuffix, paymentReportHeaders, paymentReportRows } from "@/lib/paymentReport";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || !hasPaymentUploadAccess(user)) return new Response("Unauthorized", { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (invalidPaymentDateRange(from, to)) return new Response("From date cannot be after To date.", { status: 400 });
  const finalApprovedAt = paymentApprovalDateRange(from, to);
  const claims = await prisma.claimHeader.findMany({ where: { currentStatus: "FINAL_APPROVED", ...(finalApprovedAt ? { finalApprovedAt } : {}) }, orderBy: { finalApprovedAt: "asc" } });
  return csvResponse(`claims-awaiting-payment${paymentPeriodSuffix(from, to)}.csv`, paymentReportRows(claims), paymentReportHeaders);
}
