import Link from "next/link";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { ChartIcon, DocIcon, LogoutIcon, ShieldIcon, UserIcon } from "@/components/UiIcons";

export async function Nav() {
  const user = await getSession();
  if (!user) return null;
  const superAdmin = isSuperAdmin(user);
  return (
    <header className="border-b border-line bg-white shadow-sm">
      <div className="h-1 bg-rdcGreen" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-5 text-ink">
          <RdcLogo />
          <span className="text-xl font-extrabold uppercase tracking-wide md:text-2xl">RDC Claim Management System</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-4 text-sm font-semibold">
          <NavLink href="/dashboard" icon={<DocIcon />}>My Claims</NavLink>
          {(user.role === "ACCOUNTS" || (user.role === "ADMIN" && !superAdmin)) && <NavLink href="/accounts" icon={<ShieldIcon />}>Accounts</NavLink>}
          {(user.role === "APPROVER" || (user.role === "ADMIN" && !superAdmin)) && <NavLink href="/approver" icon={<ShieldIcon />}>Approvals</NavLink>}
          {superAdmin && <NavLink href="/admin" icon={<ShieldIcon />}>Admin</NavLink>}
          {(user.role === "ACCOUNTS" || user.role === "ADMIN") && <NavLink href="/reports" icon={<ChartIcon />}>Reports</NavLink>}
          <span className="inline-flex items-center gap-2 text-rdcGreen">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-rdcGreen bg-green-50"><UserIcon className="h-5 w-5" /></span>
            {user.name}{superAdmin ? " (Superadmin)" : ""}
          </span>
          <form action="/api/auth/logout" method="post">
            <button className="inline-flex items-center gap-2 rounded-md border border-rdcGreen bg-white px-4 py-2 font-bold text-rdcGreen hover:bg-green-50">
              <LogoutIcon className="h-4 w-4" /> Logout
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-ink hover:text-rdcGreen">{icon}{children}</Link>;
}

function RdcLogo() {
  return (
    <img
      src="/rdc-logo.jpeg"
      alt="RDC - We Promise We Deliver"
      className="h-16 w-auto object-contain"
    />
  );
}
