import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/auth";
import { resetPasswordWithToken } from "@/lib/passwordReset";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (!token) return NextResponse.redirect(appRedirectUrl("/forgot-password?error=Reset%20link%20is%20missing", request), 303);
  if (password.length < 8) {
    return NextResponse.redirect(appRedirectUrl(`/reset-password?token=${encodeURIComponent(token)}&error=Password%20must%20be%20at%20least%208%20characters`, request), 303);
  }
  if (password !== confirmPassword) {
    return NextResponse.redirect(appRedirectUrl(`/reset-password?token=${encodeURIComponent(token)}&error=Passwords%20do%20not%20match`, request), 303);
  }

  const ok = await resetPasswordWithToken(token, password);
  if (!ok) {
    return NextResponse.redirect(appRedirectUrl("/forgot-password?error=Reset%20link%20is%20invalid%20or%20expired", request), 303);
  }

  return NextResponse.redirect(appRedirectUrl("/login?message=Password%20reset%20successful.%20Please%20login.", request), 303);
}
