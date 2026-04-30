"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClaimStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { addHistory, findApprovalRule, nextClaimId, notifyClaim, requiredApprovalLevel, validateApproverMapping } from "@/lib/workflow";

function money(value: FormDataEntryValue | null) {
  return Number(value || 0);
}

function requireComment(formData: FormData) {
  const comments = String(formData.get("comments") || "").trim();
  if (!comments) throw new Error("Comments are required.");
  return comments;
}

export async function createOrUpdateClaim(formData: FormData) {
  const user = await requireUser(["EMPLOYEE", "ADMIN"]);
  const claimId = String(formData.get("id") || "");
  const action = String(formData.get("action") || "draft");
  const claimTypeIds = formData.getAll("claimTypeId").map(String);
  const claimDates = formData.getAll("claimDate").map(String);
  const descriptions = formData.getAll("description").map(String);
  const amounts = formData.getAll("amount").map(Number);
  const gstAmounts = formData.getAll("gstAmount").map((v) => (String(v) ? Number(v) : null));
  const vendorNames = formData.getAll("vendorName").map(String);
  const billNumbers = formData.getAll("billNumber").map(String);
  const remarks = formData.getAll("employeeRemarks").map(String);
  const lines = claimTypeIds.map((claimTypeId, i) => ({
    claimTypeId,
    claimDate: new Date(claimDates[i]),
    description: descriptions[i],
    amount: amounts[i],
    gstAmount: gstAmounts[i],
    vendorName: vendorNames[i] || null,
    billNumber: billNumbers[i] || null,
    employeeRemarks: remarks[i] || null
  })).filter((line) => line.claimTypeId && line.amount > 0);
  if (!lines.length) throw new Error("Add at least one valid claim line.");

  const employee = await prisma.user.findUniqueOrThrow({ where: { employeeId: user.employeeId } });
  const existing = claimId ? await prisma.claimHeader.findUnique({ where: { id: claimId } }) : null;
  if (existing && !["DRAFT", "RETURNED_BY_ACCOUNTS"].includes(existing.currentStatus)) throw new Error("This claim can no longer be edited.");
  const claimTypes = await prisma.claimType.findMany({ where: { id: { in: lines.map((l) => l.claimTypeId) } } });
  for (const line of lines) {
    const type = claimTypes.find((t) => t.id === line.claimTypeId);
    if (!type?.isActive) throw new Error("Claim type must be active.");
    if (line.amount <= 0) throw new Error("Amount must be greater than zero.");
    if (type.maxAmountPerLine && line.amount > Number(type.maxAmountPerLine)) throw new Error(`${type.name} exceeds maximum amount per line.`);
  }
  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  if (action === "submit" && !(await findApprovalRule(totalAmount))) throw new Error("Approval rule must exist for submitted amount.");
  if (action === "submit") {
    const duplicateChecks = lines.filter((l) => l.billNumber).map((l) => ({ billNumber: l.billNumber, claimTypeId: l.claimTypeId, amount: l.amount }));
    if (duplicateChecks.length) {
      const duplicate = await prisma.claimLine.findFirst({
        where: {
          claimHeader: { employeeId: employee.employeeId, id: existing ? { not: existing.id } : undefined },
          OR: duplicateChecks
        }
      });
      if (duplicate) throw new Error("Duplicate warning: same bill number, claim type and amount already exists for this employee.");
    }
  }
  const status: ClaimStatus = action === "submit" ? "SUBMITTED_TO_ACCOUNTS" : "DRAFT";
  const generatedClaimId = existing?.claimId || (action === "submit" ? await nextClaimId() : `DRAFT-${Date.now()}`);

  const claim = await prisma.$transaction(async (tx) => {
    const header = existing
      ? await tx.claimHeader.update({
          where: { id: existing.id },
          data: {
            totalAmount,
            currentStatus: status,
            currentPendingWith: action === "submit" ? "ACCOUNTS" : null,
            submittedAt: action === "submit" ? new Date() : existing.submittedAt,
            lines: { deleteMany: {}, create: lines }
          }
        })
      : await tx.claimHeader.create({
          data: {
            claimId: generatedClaimId,
            employeeId: employee.employeeId,
            employeeName: employee.name,
            department: employee.department,
            location: employee.location,
            plant: employee.plant,
            costCenter: employee.costCenter,
            totalAmount,
            currentStatus: status,
            currentPendingWith: action === "submit" ? "ACCOUNTS" : null,
            submittedAt: action === "submit" ? new Date() : null,
            lines: { create: lines }
          }
        });
    if (action === "submit") {
      await tx.claimApprovalHistory.create({
        data: {
          claimHeaderId: header.id,
          actionByEmployeeId: user.employeeId,
          actionByName: user.name,
          roleAtAction: user.role,
          action: existing?.currentStatus === "RETURNED_BY_ACCOUNTS" ? "RESUBMITTED" : "SUBMITTED",
          previousStatus: existing?.currentStatus || "DRAFT",
          newStatus: "SUBMITTED_TO_ACCOUNTS"
        }
      });
    }
    return header;
  });

  if (action === "submit") await notifyClaim(claim, process.env.ACCOUNTS_EMAIL, "Accounts audit required");
  revalidatePath("/dashboard");
  redirect(`/claims/${claim.id}`);
}

export async function accountsAction(formData: FormData) {
  const user = await requireUser(["ACCOUNTS", "ADMIN"]);
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const claim = await prisma.claimHeader.findUniqueOrThrow({ where: { id } });
  let newStatus: ClaimStatus = claim.currentStatus;
  let comments: string | undefined;
  let pendingWith: string | null = claim.currentPendingWith;

  if (action === "return") {
    comments = requireComment(formData);
    newStatus = "RETURNED_BY_ACCOUNTS";
    pendingWith = claim.employeeId;
  } else if (action === "reject") {
    comments = requireComment(formData);
    newStatus = "REJECTED_BY_ACCOUNTS";
    pendingWith = null;
  } else if (action === "pass") {
    const validation = await validateApproverMapping(claim.employeeId, Number(claim.totalAmount));
    if (!validation.ok || !validation.rule || !validation.employee) throw new Error(validation.message);
    newStatus = "PENDING_LEVEL_1_APPROVAL";
    pendingWith = validation.employee.reportingManagerId!;
    const level = requiredApprovalLevel(validation.rule);
    await prisma.claimHeader.update({ where: { id }, data: { approvalLevelRequired: level } });
  } else if (action === "downloaded") {
    newStatus = "PAYMENT_DOWNLOADED";
    pendingWith = "ACCOUNTS";
  } else if (action === "paid") {
    newStatus = "PAID";
    pendingWith = null;
  }

  const updated = await prisma.claimHeader.update({
    where: { id },
    data: {
      currentStatus: newStatus,
      currentPendingWith: pendingWith,
      paymentDownloadedAt: newStatus === "PAYMENT_DOWNLOADED" ? new Date() : claim.paymentDownloadedAt,
      paidAt: newStatus === "PAID" ? new Date() : claim.paidAt
    }
  });
  await addHistory({ claimHeaderId: id, actor: user, action: `ACCOUNTS_${action.toUpperCase()}`, comments, previousStatus: claim.currentStatus, newStatus });
  const employee = await prisma.user.findUnique({ where: { employeeId: claim.employeeId } });
  const nextApprover = pendingWith ? await prisma.user.findUnique({ where: { employeeId: pendingWith } }) : null;
  if (["RETURNED_BY_ACCOUNTS", "REJECTED_BY_ACCOUNTS"].includes(newStatus)) await notifyClaim(updated, employee?.email, "Review Accounts comments");
  if (newStatus === "PENDING_LEVEL_1_APPROVAL") await notifyClaim(updated, nextApprover?.email, "Level 1 approval required");
  revalidatePath("/accounts");
  redirect(`/claims/${id}`);
}

export async function approverAction(formData: FormData) {
  const user = await requireUser(["APPROVER", "ADMIN"]);
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const claim = await prisma.claimHeader.findUniqueOrThrow({ where: { id } });
  if (claim.currentPendingWith !== user.employeeId && user.role !== "ADMIN") throw new Error("This claim is not pending with you.");
  const employee = await prisma.user.findUniqueOrThrow({ where: { employeeId: claim.employeeId } });
  let comments: string | undefined;
  let newStatus: ClaimStatus;
  let pendingWith: string | null = null;
  if (action === "reject") {
    comments = requireComment(formData);
    newStatus =
      claim.currentStatus === "PENDING_LEVEL_1_APPROVAL" ? "REJECTED_BY_LEVEL_1" :
      claim.currentStatus === "PENDING_LEVEL_2_APPROVAL" ? "REJECTED_BY_LEVEL_2" : "REJECTED_BY_LEVEL_3";
  } else if (claim.currentStatus === "PENDING_LEVEL_1_APPROVAL" && claim.approvalLevelRequired >= 2) {
    newStatus = "PENDING_LEVEL_2_APPROVAL";
    pendingWith = employee.level2ApproverId!;
  } else if (claim.currentStatus === "PENDING_LEVEL_2_APPROVAL" && claim.approvalLevelRequired >= 3) {
    newStatus = "PENDING_LEVEL_3_APPROVAL";
    pendingWith = employee.level3ApproverId!;
  } else {
    newStatus = "FINAL_APPROVED";
  }
  const updated = await prisma.claimHeader.update({
    where: { id },
    data: { currentStatus: newStatus, currentPendingWith: pendingWith, finalApprovedAt: newStatus === "FINAL_APPROVED" ? new Date() : claim.finalApprovedAt }
  });
  await addHistory({ claimHeaderId: id, actor: user, action: `APPROVER_${action.toUpperCase()}`, comments, previousStatus: claim.currentStatus, newStatus });
  const employeeMail = await prisma.user.findUnique({ where: { employeeId: claim.employeeId } });
  const next = pendingWith ? await prisma.user.findUnique({ where: { employeeId: pendingWith } }) : null;
  if (pendingWith) await notifyClaim(updated, next?.email, "Approval required");
  if (newStatus === "FINAL_APPROVED") await notifyClaim(updated, [employeeMail?.email, process.env.ACCOUNTS_EMAIL].filter(Boolean) as string[], "Claim final approved");
  if (String(newStatus).startsWith("REJECTED")) await notifyClaim(updated, [employeeMail?.email, process.env.ACCOUNTS_EMAIL].filter(Boolean) as string[], "Claim rejected");
  revalidatePath("/approver");
  redirect(`/claims/${id}`);
}

export async function saveClaimType(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name")),
    attachmentRequired: formData.get("attachmentRequired") === "on",
    maxAmountPerLine: formData.get("maxAmountPerLine") ? money(formData.get("maxAmountPerLine")) : null,
    monthlyLimit: formData.get("monthlyLimit") ? money(formData.get("monthlyLimit")) : null,
    costHead: String(formData.get("costHead") || ""),
    glCode: String(formData.get("glCode") || ""),
    isActive: formData.get("isActive") === "on"
  };
  if (id) await prisma.claimType.update({ where: { id }, data });
  else await prisma.claimType.create({ data });
  revalidatePath("/admin");
}

export async function saveApprovalRule(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("id") || "");
  const data = {
    minAmount: money(formData.get("minAmount")),
    maxAmount: formData.get("maxAmount") ? money(formData.get("maxAmount")) : null,
    requiresLevel1: formData.get("requiresLevel1") === "on",
    requiresLevel2: formData.get("requiresLevel2") === "on",
    requiresLevel3: formData.get("requiresLevel3") === "on",
    isActive: formData.get("isActive") === "on"
  };
  if (id) await prisma.approvalRule.update({ where: { id }, data });
  else await prisma.approvalRule.create({ data });
  revalidatePath("/admin");
}
