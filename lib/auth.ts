import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SessionUser = Pick<User, "employeeId" | "name" | "role" | "email" | "isActive" | "mustChangePassword">;

const COOKIE = "rdc_session";
const DEFAULT_PUBLIC_APP_URL = "https://rdc-employee-claims-production.up.railway.app";

function secret() {
  return process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signSession(user: SessionUser) {
  return jwt.sign(
    { employeeId: user.employeeId, name: user.name, role: user.role, email: user.email, mustChangePassword: user.mustChangePassword },
    secret(),
    { expiresIn: "8h" }
  );
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, secret()) as { employeeId: string };
    const user = await prisma.user.findUnique({
      where: { employeeId: decoded.employeeId },
      select: { employeeId: true, name: true, role: true, email: true, isActive: true, mustChangePassword: true }
    });
    if (!user?.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(roles?: Role[]) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export function canManageAll(role: Role) {
  return role === "ADMIN" || role === "ACCOUNTS";
}

export function homePathForRole(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "ACCOUNTS") return "/accounts";
  if (role === "APPROVER") return "/approver";
  return "/dashboard";
}

function baseAppUrl(request?: Request) {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl && !isLocalhostUrl(configuredUrl)) return configuredUrl;

  const forwardedHost = request?.headers.get("x-forwarded-host") || request?.headers.get("host");
  if (forwardedHost && !forwardedHost.startsWith("localhost") && !forwardedHost.startsWith("127.0.0.1")) {
    const protocol = request?.headers.get("x-forwarded-proto") || "https";
    return `${protocol}://${forwardedHost}`;
  }

  if (process.env.NODE_ENV === "production") return DEFAULT_PUBLIC_APP_URL;

  return request?.url || "http://localhost:3000";
}

export function appRedirectUrl(path: string, request?: Request) {
  return new URL(path, baseAppUrl(request));
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
