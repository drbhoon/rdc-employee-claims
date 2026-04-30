import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action="/api/auth/login" method="post" className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">RDC Claims Login</h1>
          <p className="text-sm text-muted">Use company employee ID and password.</p>
        </div>
        {searchParams.error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{searchParams.error}</div>}
        <div><label>Employee ID</label><input name="employeeId" required autoFocus /></div>
        <div><label>Password</label><input name="password" type="password" required /></div>
        <button className="btn w-full">Login</button>
      </form>
    </main>
  );
}
