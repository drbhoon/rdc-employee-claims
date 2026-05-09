import Link from "next/link";
import { getSession, homePathForRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: { error?: string; sent?: string } }) {
  const session = await getSession();
  if (session) redirect(homePathForRole(session.role));

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action="/api/auth/forgot-password" method="post" className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-sm text-muted">Enter your uploaded email ID to receive a reset link.</p>
        </div>
        {searchParams.error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{searchParams.error}</div>}
        {searchParams.sent && <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">{searchParams.sent}</div>}
        <div><label>Email ID</label><input name="loginId" type="email" required autoFocus /></div>
        <button className="btn w-full">Send Reset Link</button>
        <Link href="/login" className="block text-center text-sm text-brand">Back to login</Link>
      </form>
    </main>
  );
}
