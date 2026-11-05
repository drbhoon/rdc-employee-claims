import { csvResponse } from "@/lib/csv";
import { getSession, hasNationalReportAccess, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportScopeWhere } from "@/lib/reportScope";
import { normalizeGlCodes } from "@/lib/glCodes";
import { employeePaymentRows, invalidPaymentDateRange, paymentApprovalDateRange, paymentPeriodSuffix, paymentReportHeaders, paymentReportRows } from "@/lib/paymentReport";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || (user.role !== "ACCOUNTS" && !hasNationalReportAccess(user))) return new Response("Unauthorized", { status: 401 });
  const nationalAccess = hasNationalReportAccess(user);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const selectedGlCodes = (isSuperAdmin(user) ? normalizeGlCodes(searchParams.getAll("glCode")) : normalizeGlCodes(searchParams.getAll("glCode")).slice(0, 1));
  if (invalidPaymentDateRange(from, to)) return new Response("From date cannot be after To date.", { status: 400 });
  const finalApprovedAt = paymentApprovalDateRange(from, to);
  const claims = await prisma.claimHeader.findMany({
    where: {
      currentStatus: "FINAL_APPROVED",
      ...(finalApprovedAt ? { finalApprovedAt } : {}),
      ...(selectedGlCodes.length ? { lines: { some: { claimType: { glCode: { in: selectedGlCodes } } } } } : {}),
      ...reportScopeWhere(user, nationalAccess)
    },
    include: { lines: { include: { claimType: true } } },
    orderBy: { finalApprovedAt: "asc" }
  });
  const balanceRows = await prisma.employeeAdvanceBalance.findMany({ where: { employeeId: { in: [...new Set(claims.map((claim) => claim.employeeId))] } } });
  const balances = new Map(balanceRows.map((row) => [row.employeeId.toLowerCase(), Number(row.balance)]));
  const scope = nationalAccess ? "national" : "my-cleared";
  const glSuffix = selectedGlCodes.length ? `-gl-${selectedGlCodes.join("-").replace(/[^A-Za-z0-9_-]/g, "-")}` : "";
  return csvResponse(`${scope}-approved-claims-payment${paymentPeriodSuffix(from, to)}${glSuffix}.csv`, paymentReportRows(employeePaymentRows(claims, balances)), paymentReportHeaders);
}
