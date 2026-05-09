import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { sendMail } from "@/lib/email";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return NextResponse.json({ error: "Only superadmin can test email settings." }, { status: 403 });

  const form = await request.formData();
  const to = String(form.get("to") || user.email || "").trim().toLowerCase();
  if (!to) return NextResponse.json({ error: "Test email recipient is required." }, { status: 400 });

  try {
    const result = await sendMail({
      to,
      subject: "RDC Claims SMTP test",
      html: `
        <p>This is a test email from RDC Claims.</p>
        <p>If you received this message, Railway SMTP settings are working.</p>
      `
    });
    return NextResponse.json({
      ok: true,
      accepted: result?.accepted || [],
      rejected: result?.rejected || [],
      response: result?.response || "Email queued"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
