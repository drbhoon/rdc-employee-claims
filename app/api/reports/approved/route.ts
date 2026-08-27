import { csvResponse } from "@/lib/csv";
import { getSession, hasNationalReportAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function dateRange(from: string | null, to: string | null) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000+05:30`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+05:30`);
  return Object.keys(range).length ? range : undefined;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || (user.role !== "ACCOUNTS" && !hasNationalReportAccess(user))) return new Response("Unauthorized", { status: 401 });
  const nationalAccess = hasNationalReportAccess(user);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const glCode = searchParams.get("glCode");
  if (from && to && from > to) return new Response("From date cannot be after To date.", { status: 400 });
  const finalApprovedAt = dateRange(searchParams.get("from"), searchParams.get("to"));
  const claims = await prisma.claimHeader.findMany({
    where: {
      currentStatus: { in: ["FINAL_APPROVED", "PAYMENT_DOWNLOADED", "PAID"] },
      ...(finalApprovedAt ? { finalApprovedAt } : {}),
      ...(!nationalAccess ? { history: { some: { action: "ACCOUNTS_PASS", actionByEmployeeId: user.employeeId } } } : {}),
      ...(glCode && glCode !== "ALL" ? { lines: { some: { claimType: { glCode } } } } : {})
    },
    include: {
      lines: { where: glCode && glCode !== "ALL" ? { claimType: { glCode } } : undefined, include: { claimType: true } },
      history: { where: { action: "ACCOUNTS_PASS" }, orderBy: { actionDate: "desc" }, take: 1 }
    },
    orderBy: { finalApprovedAt: "desc" }
  });
  const rows: Record<string, unknown>[] = claims.flatMap((claim) => claim.lines.map((line) => ({
    "Claim ID": claim.claimId,
    "Employee Code": claim.employeeId,
    "Employee Name": claim.employeeName,
    Company: claim.company,
    Designation: claim.designation,
    Location: claim.location,
    Plant: claim.plant,
    "Cost Center": claim.costCenter,
    "Claim Type": line.claimType.name,
    "GL Code": line.claimType.glCode || "",
    "Claim Date": line.claimDate.toISOString().slice(0, 10),
    Description: line.description,
    Amount: String(line.amount),
    "GST Amount": line.gstAmount ? String(line.gstAmount) : "",
    "Vendor Name": line.vendorName,
    "Bill Number": line.billNumber,
    "Accounts Cleared By": claim.history[0]?.actionByName || "",
    "Accounts Cleared Date": claim.history[0]?.actionDate.toISOString().slice(0, 10) || "",
    "Approval Date": claim.finalApprovedAt?.toISOString().slice(0, 10),
    "Final Status": claim.currentStatus,
    "Paid Date": claim.paidAt?.toISOString().slice(0, 10) || "",
    "Payment Reference": claim.paymentReference || "",
    "Payment Remarks": claim.paymentRemarks || ""
  })));
  const summary = new Map<string, number>();
  rows.forEach((r) => {
    const key = `${r["Cost Center"] || ""}|${r["Claim Type"]}|${r["GL Code"] || ""}`;
    summary.set(key, (summary.get(key) || 0) + Number(r.Amount));
  });
  summary.forEach((amount, key) => {
    const [cc, type, glCode] = key.split("|");
    rows.push({ "Claim ID": "SUMMARY", "Employee Code": "", "Employee Name": "", Company: "", Designation: "", Location: "", Plant: "", "Cost Center": cc, "Claim Type": type, "GL Code": glCode, "Claim Date": "", Description: "Cost-wise summary", Amount: amount.toFixed(2), "GST Amount": "", "Vendor Name": "", "Bill Number": "", "Accounts Cleared By": "", "Accounts Cleared Date": "", "Approval Date": "", "Final Status": "", "Paid Date": "", "Payment Reference": "", "Payment Remarks": "" });
  });
  const period = from || to ? `-${from || "start"}-to-${to || "latest"}` : "";
  const glSuffix = glCode && glCode !== "ALL" ? `-gl-${glCode.replace(/[^A-Za-z0-9_-]/g, "-")}` : "";
  return csvResponse(`approved-claims${period}${glSuffix}.csv`, rows);
}
