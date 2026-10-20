import { csvResponse } from "@/lib/csv";
import { getSession, hasNationalReportAccess } from "@/lib/auth";
import { formatIndiaDateTime } from "@/lib/dateFormat";
import { claimsOlderThan72Hours, agingClaimStatuses } from "@/lib/agingReport";
import { reportScopeWhere } from "@/lib/reportScope";
import { prisma } from "@/lib/prisma";
import { statusLabel } from "@/lib/workflow";

export async function GET() {
  const user = await getSession();
  if (!user || (user.role !== "ACCOUNTS" && !hasNationalReportAccess(user))) return new Response("Unauthorized", { status: 401 });
  const nationalAccess = hasNationalReportAccess(user);
  const claims = await prisma.claimHeader.findMany({
    where: { ...reportScopeWhere(user, nationalAccess), currentStatus: { in: agingClaimStatuses } },
    select: {
      claimId: true,
      employeeId: true,
      employeeName: true,
      totalAmount: true,
      currentStatus: true,
      currentPendingWith: true,
      submittedAt: true,
      history: { select: { newStatus: true, actionDate: true }, orderBy: { actionDate: "desc" } }
    },
    orderBy: { submittedAt: "asc" }
  });
  const rows = claimsOlderThan72Hours(claims).map((claim) => ({
    "Claim ID": claim.claimId,
    "Employee Code": claim.employeeId,
    "Employee Name": claim.employeeName,
    Status: statusLabel(claim.currentStatus),
    "Pending With": claim.currentPendingWith || "-",
    "Pending Since": formatIndiaDateTime(claim.pendingSince),
    "Age Hours": claim.ageHours.toFixed(1),
    Amount: String(claim.totalAmount)
  }));
  return csvResponse("claims-pending-over-72-hours.csv", rows, ["Claim ID", "Employee Code", "Employee Name", "Status", "Pending With", "Pending Since", "Age Hours", "Amount"]);
}
