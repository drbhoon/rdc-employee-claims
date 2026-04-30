import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, signSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const employeeId = String(form.get("employeeId") || "").trim();
  const password = String(form.get("password") || "");
  const user = await prisma.user.findUnique({ where: { employeeId } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.redirect(new URL("/login?error=Invalid%20or%20inactive%20login", request.url));
  }
  setSessionCookie(signSession(user));
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
