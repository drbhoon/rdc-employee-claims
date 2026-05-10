import nodemailer from "nodemailer";

type MailArgs = {
  to: string | string[] | undefined | null;
  subject: string;
  html: string;
};

export async function sendMail({ to, subject, html }: MailArgs) {
  if (!to) return;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
    console.log("Email skipped:", subject, to);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
  return transporter.sendMail({ from: SMTP_FROM, to, subject, html });
}

export function claimEmailHtml(args: {
  claimId: string;
  employeeName: string;
  recipientName: string;
  totalAmount: string | number;
  currentStatus: string;
  actionText: string;
  roleText: string;
  claimPath: string;
  finalNotice?: boolean;
}) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const claimLine = args.finalNotice
    ? `${args.employeeName} Claim ID No. ${args.claimId} is ${args.currentStatus.replaceAll("_", " ")}.`
    : `${args.employeeName} Claim ID No. ${args.claimId}, Needs your ${args.actionText} as ${args.roleText}.`;
  return `
    <p>Dear ${args.recipientName},</p>
    <p>${claimLine}</p>
    <p><strong>Total Amount:</strong> INR ${args.totalAmount}</p>
    <p><a href="${appUrl}${args.claimPath}">Open Claim</a></p>
  `;
}
