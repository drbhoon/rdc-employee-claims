import { rm } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Only superadmin can reset test data." }, { status: 403 });

  const form = await request.formData();
  if (String(form.get("confirm") || "").trim().toUpperCase() !== "RESET") {
    return NextResponse.json({ error: "Type RESET to confirm database cleanup." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const attachments = await tx.claimAttachment.deleteMany({});
    const lines = await tx.claimLine.deleteMany({});
    const history = await tx.claimApprovalHistory.deleteMany({});
    const claims = await tx.claimHeader.deleteMany({});
    const uploadErrors = await tx.employeeUploadError.deleteMany({});
    const uploadBatches = await tx.employeeUploadBatch.deleteMany({});
    const resetTokens = await tx.passwordResetToken.deleteMany({});
    const users = await tx.user.deleteMany({ where: { employeeId: { not: "SUPERADMIN" } } });
    return {
      attachments: attachments.count,
      lines: lines.count,
      history: history.count,
      claims: claims.count,
      uploadErrors: uploadErrors.count,
      uploadBatches: uploadBatches.count,
      resetTokens: resetTokens.count,
      users: users.count
    };
  });

  const cwd = path.resolve(process.cwd());
  const uploadDir = path.resolve(cwd, "uploads");
  if (uploadDir.startsWith(cwd)) {
    await rm(uploadDir, { recursive: true, force: true });
  }

  return NextResponse.json({ ok: true, ...result });
}
