import { ClaimHeader, ClaimStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { claimEmailHtml, sendMail } from "@/lib/email";

export async function nextClaimId() {
  const year = new Date().getFullYear();
  const count = await prisma.claimHeader.count({
    where: { claimId: { startsWith: `CLM-${year}-` } }
  });
  return `CLM-${year}-${String(count + 1).padStart(6, "0")}`;
}

export async function findApprovalRule(totalAmount: number) {
  const rules = await prisma.approvalRule.findMany({ where: { isActive: true }, orderBy: { minAmount: "asc" } });
  return rules.find((rule) => Number(rule.minAmount) <= totalAmount && (rule.maxAmount == null || Number(rule.maxAmount) >= totalAmount));
}

export function requiredApprovalLevel(rule: Awaited<ReturnType<typeof findApprovalRule>>) {
  if (!rule) return 0;
  if (rule.requiresLevel3) return 3;
  if (rule.requiresLevel2) return 2;
  if (rule.requiresLevel1) return 1;
  return 0;
}

export async function validateApproverMapping(employeeId: string, totalAmount: number) {
  const employee = await prisma.user.findUnique({ where: { employeeId } });
  const rule = await findApprovalRule(totalAmount);
  if (!rule) return { ok: false, message: "No active approval rule exists for this claim amount." };
  if (rule.requiresLevel1 && !employee?.reportingManagerId) return { ok: false, message: "Level 1 approver mapping is missing." };
  if (rule.requiresLevel2 && !employee?.level2ApproverId) return { ok: false, message: "Level 2 approver mapping is missing." };
  if (rule.requiresLevel3 && !employee?.level3ApproverId) return { ok: false, message: "Level 3 approver mapping is missing." };
  return { ok: true, rule, employee };
}

export async function addHistory(args: {
  claimHeaderId: string;
  actor: { employeeId: string; name: string; role: Role };
  action: string;
  comments?: string;
  previousStatus: ClaimStatus;
  newStatus: ClaimStatus;
}) {
  await prisma.claimApprovalHistory.create({
    data: {
      claimHeaderId: args.claimHeaderId,
      actionByEmployeeId: args.actor.employeeId,
      actionByName: args.actor.name,
      roleAtAction: args.actor.role,
      action: args.action,
      comments: args.comments,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus
    }
  });
}

export async function notifyClaim(claim: ClaimHeader, to: string | string[] | undefined | null, actionRequired: string) {
  await sendMail({
    to,
    subject: `${claim.claimId} - ${claim.currentStatus}`,
    html: claimEmailHtml({
      claimId: claim.claimId,
      employeeName: claim.employeeName,
      totalAmount: String(claim.totalAmount),
      currentStatus: claim.currentStatus,
      actionRequired,
      claimPath: `/claims/${claim.id}`
    })
  });
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}
