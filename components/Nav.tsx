import Link from "next/link";
import { getSession } from "@/lib/auth";

export async function Nav() {
  const user = await getSession();
  if (!user) return null;
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-bold text-ink">RDC Claims</Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/dashboard">Employee</Link>
          {(user.role === "ACCOUNTS" || user.role === "ADMIN") && <Link href="/accounts">Accounts Verifier</Link>}
          {(user.role === "APPROVER" || user.role === "ADMIN") && <Link href="/approver">Approver</Link>}
          {user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
          {(user.role === "ACCOUNTS" || user.role === "ADMIN") && <Link href="/reports">Reports</Link>}
          <span className="text-muted">{user.name} ({user.role})</span>
          <form action="/api/auth/logout" method="post"><button className="btn-secondary">Logout</button></form>
        </nav>
      </div>
    </header>
  );
}
