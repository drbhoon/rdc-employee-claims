import Link from "next/link";
import { getSession, homePathForRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; message?: string } }) {
  const session = await getSession();
  if (session?.mustChangePassword) redirect("/change-password");
  if (session) redirect(homePathForRole(session.role));
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action="/api/auth/login" method="post" className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">RDC Claims Login</h1>
          <p className="text-sm text-muted">Use company email ID and password.</p>
        </div>
        {searchParams.error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{searchParams.error}</div>}
        {searchParams.message && <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">{searchParams.message}</div>}
        <div><label>Email ID</label><input name="loginId" type="email" required autoFocus /></div>
        <div><label>Password</label><input name="password" type="password" required /></div>
        <button className="btn w-full">Login</button>
        <Link href="/forgot-password" className="block text-center text-sm text-brand">Forgot password?</Link>
      </form>
    </main>
  );
}
