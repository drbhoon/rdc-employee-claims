"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClaimStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { allowedFileTypes } from "@/lib/constants";
import { addHistory, findApprovalRule, nextClaimId, notifyClaim, requiredApprovalLevel, validateApproverMapping } from "@/lib/workflow";

function money(value: FormDataEntryValue | null) {
  return Number(value || 0);
}

function actionError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function requireComment(formData: FormData, path: string, label: string) {
  const comments = String(formData.get("comments") || "").trim();
  if (!comments) actionError(path, `${label}: reason/comments are required.`);
  return comments;
}

export async function createOrUpdateClaim(formData: FormData) {
  const user = await requireUser();
  const claimId = String(formData.get("id") || "");
  const errorPath = claimId ? `/claims/${claimId}` : "/claims/new";
  const action = String(formData.get("action") || "draft");
  const claimTypeIds = formData.getAll("claimTypeId").map(String);
  const claimDates = formData.getAll("claimDate").map(String);
  const descriptions = formData.getAll("description").map(String);
  const amounts = formData.getAll("amount").map(Number);
  const attachments = formData.getAll("attachment") as File[];
  const vendorNames = formData.getAll("vendorName").map(String);
  const billNumbers = formData.getAll("billNumber").map(String);
  const remarks = formData.getAll("employeeRemarks").map(String);
  const lines = claimTypeIds.map((claimTypeId, i) => ({
    claimTypeId,
    claimDate: claimDates[i] ? new Date(claimDates[i]) : new Date(),
    description: descriptions[i],
    amount: amounts[i],
    gstAmount: null,
    vendorName: vendorNames[i] || null,
    billNumber: billNumbers[i] || null,
    employeeRemarks: remarks[i] || null,
    attachment: attachments[i]
  })).filter((line) => line.claimTypeId && line.amount > 0);
  if (!lines.length) actionError(errorPath, "Claim line entry: add at least one expense type with an amount greater than zero.");
  for (const line of lines) {
    if (line.attachment?.size) {
      const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 5);
      if (!allowedFileTypes.includes(line.attachment.type)) actionError(errorPath, "Supporting document upload: only PDF, JPG, JPEG and PNG files are allowed.");
      if (line.attachment.size > maxMb * 1024 * 1024) actionError(errorPath, `Supporting document upload: file exceeds ${maxMb}MB.`);
    }
  }

  const employee = await prisma.user.findUniqueOrThrow({ where: { employeeId: user.employeeId } });
  const existing = claimId ? await prisma.claimHeader.findUnique({ where: { id: claimId } }) : null;
  if (claimId && !existing) actionError("/dashboard", "Claim edit: claim was not found.");
  if (existing && existing.employeeId !== user.employeeId) actionError(errorPath, "Claim edit: you can edit only your own claims.");
  if (existing && !["DRAFT", "RETURNED_BY_ACCOUNTS"].includes(existing.currentStatus)) actionError(errorPath, "Claim edit: this claim can no longer be edited.");
  const claimTypes = await prisma.claimType.findMany({ where: { id: { in: lines.map((l) => l.claimTypeId) } } });
  for (const line of lines) {
    const type = claimTypes.find((t) => t.id === line.claimTypeId);
    if (!type?.isActive) actionError(errorPath, "Claim line entry: selected expense type is inactive.");
    if (line.amount <= 0) actionError(errorPath, "Claim line entry: amount must be greater than zero.");
    if (type.maxAmountPerLine && line.amount > Number(type.maxAmountPerLine)) actionError(errorPath, `Claim line entry: ${type.name} exceeds maximum amount per line.`);
  }
  const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  if (action === "submit" && !(await findApprovalRule(totalAmount))) actionError(errorPath, "Approval routing: no active approval rule exists for this claim amount.");
  if (action === "submit" && !employee.accountsEmail) actionError(errorPath, "Approval routing: Accounts email mapping is missing for your employee master.");
  if (action === "submit") {
    const duplicateChecks = lines.filter((l) => l.billNumber).map((l) => ({ billNumber: l.billNumber, claimTypeId: l.claimTypeId, amount: l.amount }));
    if (duplicateChecks.length) {
      const duplicate = await prisma.claimLine.findFirst({
        where: {
          claimHeader: { employeeId: employee.employeeId, id: existing ? { not: existing.id } : undefined },
          OR: duplicateChecks
        }
      });
      if (duplicate) actionError(errorPath, "Duplicate warning: same bill number, expense type and amount already exists for this employee.");
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
            currentPendingWith: action === "submit" ? employee.accountsEmail : null,
            submittedAt: action === "submit" ? new Date() : existing.submittedAt,
            lines: { deleteMany: {} }
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
            currentPendingWith: action === "submit" ? employee.accountsEmail : null,
            submittedAt: action === "submit" ? new Date() : null
          }
        });
    for (const line of lines) {
      const createdLine = await tx.claimLine.create({
        data: {
          claimHeaderId: header.id,
          claimTypeId: line.claimTypeId,
          claimDate: line.claimDate,
          description: line.description,
          amount: line.amount,
          gstAmount: null,
          vendorName: line.vendorName,
          billNumber: line.billNumber,
          employeeRemarks: line.employeeRemarks
        }
      });
      if (line.attachment?.size) {
        const ext = path.extname(line.attachment.name).toLowerCase();
        const stored = `${randomUUID()}${ext}`;
        const dir = path.join(process.cwd(), "uploads");
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, stored), Buffer.from(await line.attachment.arrayBuffer()));
        await tx.claimAttachment.create({
          data: {
            claimLineId: createdLine.id,
            fileName: line.attachment.name,
            fileUrl: `/api/attachments/${stored}`,
            fileType: line.attachment.type,
            fileSize: line.attachment.size,
            uploadedBy: user.employeeId
          }
        });
      }
    }
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

  if (action === "submit") await notifyClaim(claim, employee.accountsEmail, "Accounts audit required");
  revalidatePath("/dashboard");
  redirect(`/claims/${claim.id}`);
}

export async function accountsAction(formData: FormData) {
  const user = await requireUser(["ACCOUNTS", "ADMIN"]);
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const errorPath = `/claims/${id}`;
  const claim = await prisma.claimHeader.findUniqueOrThrow({ where: { id }, include: { employee: true } });
  if (user.role !== "ADMIN" && claim.employee.accountsEmail !== user.email) actionError(errorPath, "Accounts action: this claim is not mapped to your Accounts email.");
  if (["pass", "return", "reject"].includes(action) && claim.currentStatus !== "SUBMITTED_TO_ACCOUNTS") actionError(errorPath, "Accounts action: claim is not pending Accounts audit.");
  if (action === "downloaded" && claim.currentStatus !== "FINAL_APPROVED") actionError(errorPath, "Payment action: only final-approved claims can be marked downloaded.");
  if (action === "paid" && claim.currentStatus !== "PAYMENT_DOWNLOADED") actionError(errorPath, "Payment action: only downloaded claims can be marked paid.");
  let newStatus: ClaimStatus = claim.currentStatus;
  let comments: string | undefined;
  let pendingWith: string | null = claim.currentPendingWith;

  if (action === "return") {
    comments = requireComment(formData, errorPath, "Accounts return");
    newStatus = "RETURNED_BY_ACCOUNTS";
    pendingWith = claim.employeeId;
  } else if (action === "reject") {
    comments = requireComment(formData, errorPath, "Accounts rejection");
    newStatus = "REJECTED_BY_ACCOUNTS";
    pendingWith = null;
  } else if (action === "pass") {
    const validation = await validateApproverMapping(claim.employeeId, Number(claim.totalAmount));
    if (!validation.ok || !validation.rule || !validation.employee) actionError(errorPath, `Approval routing: ${validation.message}`);
    newStatus = "PENDING_LEVEL_1_APPROVAL";
    pendingWith = validation.employee.rmEmail || validation.employee.level1Email!;
    const level = requiredApprovalLevel(validation.rule);
    await prisma.claimHeader.update({ where: { id }, data: { approvalLevelRequired: level } });
  } else if (action === "downloaded") {
    newStatus = "PAYMENT_DOWNLOADED";
    pendingWith = user.email;
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
  const nextApprover = pendingWith ? await prisma.user.findFirst({ where: { OR: [{ employeeId: pendingWith }, { email: pendingWith }] } }) : null;
  if (["RETURNED_BY_ACCOUNTS", "REJECTED_BY_ACCOUNTS"].includes(newStatus)) await notifyClaim(updated, employee?.email, "Review Accounts comments");
  if (newStatus === "PENDING_LEVEL_1_APPROVAL") await notifyClaim(updated, nextApprover?.email || pendingWith, pendingWith === employee?.rmEmail ? "RM recommendation required" : "Level 1 approval required");
  revalidatePath("/accounts");
  revalidatePath("/approver");
  revalidatePath("/dashboard");
  redirect("/accounts");
}

export async function approverAction(formData: FormData) {
  const user = await requireUser(["APPROVER", "ADMIN"]);
  const id = String(formData.get("id"));
  const action = String(formData.get("action"));
  const errorPath = `/claims/${id}`;
  const claim = await prisma.claimHeader.findUniqueOrThrow({ where: { id } });
  if (claim.currentPendingWith !== user.email && claim.currentPendingWith !== user.employeeId && user.role !== "ADMIN") actionError(errorPath, "Approver action: this claim is not pending with your login email.");
  if (!["PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"].includes(claim.currentStatus)) actionError(errorPath, "Approver action: this claim is not pending approval.");
  const employee = await prisma.user.findUniqueOrThrow({ where: { employeeId: claim.employeeId } });
  const isRmRecommendation = claim.currentStatus === "PENDING_LEVEL_1_APPROVAL" && !!employee.rmEmail && claim.currentPendingWith === employee.rmEmail;
  let comments: string | undefined;
  let newStatus: ClaimStatus;
  let pendingWith: string | null = null;
  if (action === "reject") {
    comments = requireComment(formData, errorPath, "Approver rejection");
    newStatus =
      claim.currentStatus === "PENDING_LEVEL_1_APPROVAL" ? "REJECTED_BY_LEVEL_1" :
      claim.currentStatus === "PENDING_LEVEL_2_APPROVAL" ? "REJECTED_BY_LEVEL_2" : "REJECTED_BY_LEVEL_3";
  } else if (claim.currentStatus === "PENDING_LEVEL_1_APPROVAL" && claim.approvalLevelRequired >= 2) {
    if (isRmRecommendation) {
      newStatus = "PENDING_LEVEL_1_APPROVAL";
      pendingWith = employee.level1Email!;
    } else {
      newStatus = "PENDING_LEVEL_2_APPROVAL";
      pendingWith = employee.level2Email!;
    }
  } else if (isRmRecommendation) {
    newStatus = "PENDING_LEVEL_1_APPROVAL";
    pendingWith = employee.level1Email!;
  } else {
    newStatus = "FINAL_APPROVED";
  }
  const updated = await prisma.claimHeader.update({
    where: { id },
    data: { currentStatus: newStatus, currentPendingWith: pendingWith, finalApprovedAt: newStatus === "FINAL_APPROVED" ? new Date() : claim.finalApprovedAt }
  });
  const actorName =
    isRmRecommendation ? (employee.rmName || user.name) :
    claim.currentStatus === "PENDING_LEVEL_1_APPROVAL" ? (employee.level1Name || user.name) :
    claim.currentStatus === "PENDING_LEVEL_2_APPROVAL" ? (employee.level2Name || user.name) :
    user.name;
  await addHistory({ claimHeaderId: id, actor: { ...user, name: actorName }, action: `APPROVER_${action.toUpperCase()}`, comments, previousStatus: claim.currentStatus, newStatus });
  const employeeMail = await prisma.user.findUnique({ where: { employeeId: claim.employeeId } });
  const next = pendingWith ? await prisma.user.findFirst({ where: { OR: [{ employeeId: pendingWith }, { email: pendingWith }] } }) : null;
  if (pendingWith) await notifyClaim(updated, next?.email || pendingWith, isRmRecommendation ? "Level 1 approval required" : "Level 2 approval required");
  if (newStatus === "FINAL_APPROVED") {
    const finalRecipients = [employeeMail?.email, employee.accountsEmail, employee.level1Email];
    if (claim.approvalLevelRequired >= 2 || Number(claim.totalAmount) > 25000) finalRecipients.push(employee.level2Email);
    await notifyClaim(updated, [...new Set(finalRecipients.filter(Boolean))] as string[], "Claim final approved");
  }
  if (String(newStatus).startsWith("REJECTED")) await notifyClaim(updated, [employeeMail?.email, employee.accountsEmail].filter(Boolean) as string[], "Claim rejected");
  revalidatePath("/approver");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  redirect("/approver");
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
    requiresLevel3: false,
    isActive: formData.get("isActive") === "on"
  };
  if (id) await prisma.approvalRule.update({ where: { id }, data });
  else await prisma.approvalRule.create({ data });
  revalidatePath("/admin");
}
