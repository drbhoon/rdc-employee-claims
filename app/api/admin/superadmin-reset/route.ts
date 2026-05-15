import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { sendPasswordResetLink } from "@/lib/passwordReset";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) {
    return NextResponse.json({ error: "Only superadmin can send this reset link." }, { status: 403 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "Superadmin email is missing." }, { status: 400 });
  }

  try {
    await sendPasswordResetLink(user.email, request);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset email could not be sent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
