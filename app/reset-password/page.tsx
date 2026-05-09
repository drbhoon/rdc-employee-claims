import Link from "next/link";
import { getSession, homePathForRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ResetPasswordPage({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  const session = await getSession();
  if (session) redirect(homePathForRole(session.role));
  const token = searchParams.token || "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action="/api/auth/reset-password" method="post" className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-sm text-muted">Use the reset link sent to your email ID.</p>
        </div>
        {searchParams.error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{searchParams.error}</div>}
        {!token && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">Reset link is missing.</div>}
        <input name="token" type="hidden" value={token} />
        <div><label>New Password</label><input name="password" type="password" required minLength={8} autoFocus /></div>
        <div><label>Confirm Password</label><input name="confirmPassword" type="password" required minLength={8} /></div>
        <button className="btn w-full" disabled={!token}>Reset Password</button>
        <Link href="/login" className="block text-center text-sm text-brand">Back to login</Link>
      </form>
    </main>
  );
}
