import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ChangePasswordPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4">
      <form action="/api/auth/change-password" method="post" className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Change Password</h1>
          <p className="text-sm text-muted">Set your own password before continuing.</p>
        </div>
        {searchParams.error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{searchParams.error}</div>}
        <div><label>Current Password</label><input name="currentPassword" type="password" required autoFocus /></div>
        <div><label>New Password</label><input name="password" type="password" required minLength={8} /></div>
        <div><label>Confirm Password</label><input name="confirmPassword" type="password" required minLength={8} /></div>
        <button className="btn w-full">Change Password</button>
      </form>
    </main>
  );
}
