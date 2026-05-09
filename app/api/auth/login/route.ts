import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appRedirectUrl, homePathForRole, setSessionCookie, signSession, verifyPassword } from "@/lib/auth";

export async function GET(request: Request) {
  return NextResponse.redirect(appRedirectUrl("/login", request));
}

export async function POST(request: Request) {
  const form = await request.formData();
  const loginId = String(form.get("loginId") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const user = await prisma.user.findUnique({ where: { email: loginId } });
  if (!user || !user.isActive) {
    return NextResponse.redirect(appRedirectUrl("/login?error=Email%20ID%20not%20found%20or%20inactive.%20Please%20check%20uploaded%20login_id%20in%20employee%20master.", request));
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.redirect(appRedirectUrl("/login?error=Incorrect%20password.%20Use%20Forgot%20password%20to%20receive%20a%20reset%20link.", request));
  }
  setSessionCookie(signSession(user));
  return NextResponse.redirect(appRedirectUrl(homePathForRole(user.role), request));
}
