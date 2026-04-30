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
  await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
}

export function claimEmailHtml(args: {
  claimId: string;
  employeeName: string;
  totalAmount: string | number;
  currentStatus: string;
  actionRequired: string;
  claimPath: string;
}) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `
    <p><strong>Claim ID:</strong> ${args.claimId}</p>
    <p><strong>Employee:</strong> ${args.employeeName}</p>
    <p><strong>Total Amount:</strong> INR ${args.totalAmount}</p>
    <p><strong>Status:</strong> ${args.currentStatus}</p>
    <p><strong>Action Required:</strong> ${args.actionRequired}</p>
    <p><a href="${appUrl}${args.claimPath}">Open claim</a></p>
  `;
}
