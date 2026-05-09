import { NextResponse } from "next/server";
import { appRedirectUrl } from "@/lib/auth";
import { sendPasswordResetLink } from "@/lib/passwordReset";

export async function POST(request: Request) {
  const form = await request.formData();
  const loginId = String(form.get("loginId") || "").trim().toLowerCase();
  if (!loginId) {
    return NextResponse.redirect(appRedirectUrl("/forgot-password?error=Email%20ID%20is%20required", request), 303);
  }

  await sendPasswordResetLink(loginId, request);
  return NextResponse.redirect(
    appRedirectUrl("/forgot-password?sent=If%20this%20email%20is%20active%2C%20a%20reset%20link%20has%20been%20sent.", request),
    303
  );
}
