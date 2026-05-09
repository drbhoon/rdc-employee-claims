import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/auth";
import { sendPasswordResetLink } from "@/lib/passwordReset";

export async function POST(request: Request) {
  const form = await request.formData();
  const loginId = String(form.get("loginId") || "").trim().toLowerCase();
  if (!loginId) {
    return NextResponse.redirect(appRedirectUrl("/forgot-password?error=Email%20ID%20is%20required", request), 303);
  }

  try {
    await sendPasswordResetLink(loginId, request);
  } catch (error) {
    console.error("Password reset email failed", error);
    return NextResponse.redirect(
      appRedirectUrl("/forgot-password?error=Reset%20email%20could%20not%20be%20sent.%20Please%20check%20SMTP%20settings.", request),
      303
    );
  }

  return NextResponse.redirect(
    appRedirectUrl("/forgot-password?sent=If%20this%20email%20is%20active%2C%20a%20reset%20link%20has%20been%20sent.", request),
    303
  );
}
