import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appRedirectUrl, getSession, hashPassword, homePathForRole, setSessionCookie, signSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(appRedirectUrl("/login", request), 303);

  const form = await request.formData();
  const currentPassword = String(form.get("currentPassword") || "");
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (password.length < 8) {
    return NextResponse.redirect(appRedirectUrl("/change-password?error=Password%20must%20be%20at%20least%208%20characters", request), 303);
  }
  if (password !== confirmPassword) {
    return NextResponse.redirect(appRedirectUrl("/change-password?error=Passwords%20do%20not%20match", request), 303);
  }
  if (password === currentPassword) {
    return NextResponse.redirect(appRedirectUrl("/change-password?error=New%20password%20must%20be%20different%20from%20current%20password", request), 303);
  }

  const user = await prisma.user.findUnique({ where: { employeeId: session.employeeId } });
  if (!user || !user.isActive || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.redirect(appRedirectUrl("/change-password?error=Current%20password%20is%20incorrect", request), 303);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false }
  });
  setSessionCookie(signSession(updated));
  return NextResponse.redirect(appRedirectUrl(homePathForRole(updated.role), request), 303);
}
