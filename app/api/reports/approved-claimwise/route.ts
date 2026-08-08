import { csvResponse } from "@/lib/csv";
import { getSession, hasNationalReportAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { employeePaymentRows, invalidPaymentDateRange, paymentApprovalDateRange, paymentPeriodSuffix, paymentReportHeaders, paymentReportRows } from "@/lib/paymentReport";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || (user.role !== "ACCOUNTS" && !hasNationalReportAccess(user))) return new Response("Unauthorized", { status: 401 });
  const nationalAccess = hasNationalReportAccess(user);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (invalidPaymentDateRange(from, to)) return new Response("From date cannot be after To date.", { status: 400 });
  const finalApprovedAt = paymentApprovalDateRange(from, to);
  const claims = await prisma.claimHeader.findMany({
    where: {
      currentStatus: "FINAL_APPROVED",
      ...(finalApprovedAt ? { finalApprovedAt } : {}),
      ...(!nationalAccess ? { history: { some: { action: "ACCOUNTS_PASS", actionByEmployeeId: user.employeeId } } } : {})
    },
    include: { lines: { include: { claimType: true } } },
    orderBy: { finalApprovedAt: "asc" }
  });
  const balanceRows = await prisma.employeeAdvanceBalance.findMany({ where: { employeeId: { in: [...new Set(claims.map((claim) => claim.employeeId))] } } });
  const balances = new Map(balanceRows.map((row) => [row.employeeId.toLowerCase(), Number(row.balance)]));
  const scope = nationalAccess ? "national" : "my-cleared";
  return csvResponse(`${scope}-approved-claims-payment${paymentPeriodSuffix(from, to)}.csv`, paymentReportRows(employeePaymentRows(claims, balances)), paymentReportHeaders);
}
