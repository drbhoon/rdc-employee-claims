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
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.redirect(appRedirectUrl("/login?error=Invalid%20or%20inactive%20login", request));
  }
  setSessionCookie(signSession(user));
  return NextResponse.redirect(appRedirectUrl(homePathForRole(user.role), request));
}
