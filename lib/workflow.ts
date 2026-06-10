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
  if (rule.requiresLevel2) return 2;
  if (rule.requiresLevel1) return 1;
  return 0;
}

export async function validateApproverMapping(employeeId: string, totalAmount: number) {
  const employee = await prisma.user.findUnique({ where: { employeeId } });
  const rule = await findApprovalRule(totalAmount);
  if (!rule) return { ok: false, message: "No active approval rule exists for this claim amount." };
  if (!employee?.accountsEmail) return { ok: false, message: "Accounts email mapping is missing." };
  if (rule.requiresLevel1 && !employee?.level1Email) return { ok: false, message: "Level 1 approver email mapping is missing." };
  if (rule.requiresLevel2 && !employee?.level2Email) return { ok: false, message: "Level 2 approver email mapping is missing." };
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
  const recipients = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean).map((item) => String(item).toLowerCase()))];
  if (!recipients.length) return;

  const employee = await prisma.user.findUnique({ where: { employeeId: claim.employeeId } });
  const users = await prisma.user.findMany({
    where: { email: { in: recipients } },
    select: { email: true, name: true }
  });
  const userNameByEmail = new Map(users.map((item) => [item.email?.toLowerCase(), item.name]));

  const results = await Promise.allSettled(recipients.map(async (recipient) => {
    const context = notificationContext(recipient, actionRequired, employee, userNameByEmail.get(recipient));
    await sendMail({
      to: recipient,
      subject: `${claim.claimId} - ${context.subject}`,
      html: claimEmailHtml({
        claimId: claim.claimId,
        employeeName: claim.employeeName,
        recipientName: context.recipientName,
        totalAmount: String(claim.totalAmount),
        currentStatus: claim.currentStatus,
        actionText: context.actionText,
        roleText: context.roleText,
        finalNotice: context.finalNotice,
        claimPath: `/claims/${claim.id}`
      })
    });
  }));

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Claim email failed", {
        claimId: claim.claimId,
        to: recipients[index],
        actionRequired,
        error: result.reason instanceof Error ? result.reason.message : result.reason
      });
    }
  });
}

export function notifyClaimInBackground(claim: ClaimHeader, to: string | string[] | undefined | null, actionRequired: string) {
  setTimeout(() => {
    void notifyClaim(claim, to, actionRequired).catch((error) => {
      console.error("Claim background email failed", {
        claimId: claim.claimId,
        actionRequired,
        error: error instanceof Error ? error.message : error
      });
    });
  }, 0);
}

function notificationContext(
  recipient: string,
  actionRequired: string,
  employee: Awaited<ReturnType<typeof prisma.user.findUnique>>,
  userName?: string
) {
  const text = actionRequired.toLowerCase();
  if (text.includes("final approved") || text.includes("rejected")) {
    return {
      recipientName: displayName(userName || mappedName(recipient, employee) || recipient),
      actionText: "Information",
      roleText: "Recipient",
      subject: actionRequired,
      finalNotice: true
    };
  }
  if (recipient === employee?.accountsEmail?.toLowerCase() || text.includes("accounts")) {
    return {
      recipientName: displayName(employee?.accountsName || userName || recipient),
      actionText: "Verification",
      roleText: "Accounts Verifier",
      subject: "Verification Required",
      finalNotice: false
    };
  }
  if (recipient === employee?.rmEmail?.toLowerCase() || text.includes("rm")) {
    return {
      recipientName: displayName(employee?.rmName || userName || recipient),
      actionText: "Approval",
      roleText: "RM Approver",
      subject: "RM Approval Required",
      finalNotice: false
    };
  }
  if (recipient === employee?.level2Email?.toLowerCase() || text.includes("level 2")) {
    return {
      recipientName: displayName(employee?.level2Name || userName || recipient),
      actionText: "Approval",
      roleText: "LEVEL2 Approver",
      subject: "Level2 Approval Required",
      finalNotice: false
    };
  }
  if (recipient === employee?.level1Email?.toLowerCase() || text.includes("level 1")) {
    return {
      recipientName: displayName(employee?.level1Name || userName || recipient),
      actionText: "Approval",
      roleText: "LEVEL1 Approver",
      subject: "Level1 Approval Required",
      finalNotice: false
    };
  }
  return {
    recipientName: displayName(userName || employee?.name || recipient),
    actionText: "Review",
    roleText: "Employee",
    subject: actionRequired,
    finalNotice: false
  };
}

function mappedName(recipient: string, employee: Awaited<ReturnType<typeof prisma.user.findUnique>>) {
  if (recipient === employee?.accountsEmail?.toLowerCase()) return employee.accountsName;
  if (recipient === employee?.rmEmail?.toLowerCase()) return employee.rmName;
  if (recipient === employee?.level1Email?.toLowerCase()) return employee.level1Name;
  if (recipient === employee?.level2Email?.toLowerCase()) return employee.level2Name;
  if (recipient === employee?.email?.toLowerCase()) return employee.name;
  return null;
}

function displayName(value: string) {
  return value.includes("@") ? value.split("@")[0] : value;
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_LEVEL_1_APPROVAL: "Pending RM/Level1 Approval",
    REJECTED_BY_LEVEL_1: "Rejected By RM/Level1",
    PENDING_LEVEL_2_APPROVAL: "Pending Level2 Approval",
    REJECTED_BY_LEVEL_2: "Rejected By Level2",
    PENDING_LEVEL_3_APPROVAL: "Pending Level3 Approval",
    REJECTED_BY_LEVEL_3: "Rejected By Level3"
  };
  if (labels[status]) return labels[status];
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}
