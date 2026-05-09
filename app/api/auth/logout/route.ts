import { NextResponse } from "next/server";
import { appRedirectUrl, clearSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  clearSessionCookie();
  return NextResponse.redirect(appRedirectUrl("/login", request));
}
