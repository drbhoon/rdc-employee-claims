import bcrypt from "bcryptjs";
import crypto from "crypto";
import { appRedirectUrl } from "@/lib/auth";
import { sendMail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_MINUTES = 30;

export function passwordResetTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendPasswordResetLink(email: string, request: Request) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user?.isActive || !user.email) return false;

  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      email: user.email,
      tokenHash: passwordResetTokenHash(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000)
    }
  });

  const resetUrl = appRedirectUrl(`/reset-password?token=${encodeURIComponent(token)}`, request).toString();
  await sendMail({
    to: user.email,
    subject: "RDC Claims password reset",
    html: `
      <p>Hello ${escapeHtml(user.name)},</p>
      <p>A password reset was requested for your RDC Claims login.</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link will expire in ${RESET_TOKEN_MINUTES} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `
  });
  return true;
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: passwordResetTokenHash(token) },
    include: { user: true }
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || !reset.user.isActive) return false;

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash, mustChangePassword: false }
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() }
    })
  ]);
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
