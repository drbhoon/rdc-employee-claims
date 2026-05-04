import { csvResponse } from "@/lib/csv";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function dateRange(from: string | null, to: string | null) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000+05:30`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+05:30`);
  return Object.keys(range).length ? range : undefined;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || !["ACCOUNTS", "ADMIN"].includes(user.role)) return new Response("Unauthorized", { status: 401 });
  const { searchParams } = new URL(request.url);
  const finalApprovedAt = dateRange(searchParams.get("from"), searchParams.get("to"));
  const claims = await prisma.claimHeader.findMany({
    where: {
      currentStatus: { in: ["FINAL_APPROVED", "PAYMENT_DOWNLOADED", "PAID"] },
      ...(finalApprovedAt ? { finalApprovedAt } : {})
    },
    include: { lines: { include: { claimType: true } } },
    orderBy: { finalApprovedAt: "desc" }
  });
  const rows: Record<string, unknown>[] = claims.flatMap((claim) => claim.lines.map((line) => ({
    "Claim ID": claim.claimId,
    "Employee ID": claim.employeeId,
    "Employee Name": claim.employeeName,
    Department: claim.department,
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
    "Approval Date": claim.finalApprovedAt?.toISOString().slice(0, 10),
    "Final Status": claim.currentStatus
  })));
  const summary = new Map<string, number>();
  rows.forEach((r) => {
    const key = `${r["Cost Center"] || ""}|${r["Claim Type"]}|${r["GL Code"] || ""}`;
    summary.set(key, (summary.get(key) || 0) + Number(r.Amount));
  });
  summary.forEach((amount, key) => {
    const [cc, type, glCode] = key.split("|");
    rows.push({ "Claim ID": "SUMMARY", "Employee ID": "", "Employee Name": "", Department: "", Location: "", Plant: "", "Cost Center": cc, "Claim Type": type, "GL Code": glCode, "Claim Date": "", Description: "Cost-wise summary", Amount: amount.toFixed(2), "GST Amount": "", "Vendor Name": "", "Bill Number": "", "Approval Date": "", "Final Status": "" });
  });
  return csvResponse("approved-claims.csv", rows);
}
