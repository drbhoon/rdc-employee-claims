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
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2 text-ink sm:gap-4">
          <RdcLogo />
          <span className="text-lg font-extrabold uppercase leading-tight tracking-wide sm:hidden">RDC Claims</span>
          <span className="hidden min-w-0 text-xl font-extrabold uppercase leading-tight tracking-wide sm:inline lg:text-2xl">RDC Claim Management System</span>
        </Link>
        <nav className="grid w-full grid-cols-2 items-center gap-2 text-sm font-semibold sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
          <NavLink href="/dashboard" icon={<DocIcon />}>My Claims</NavLink>
          {(user.role === "ACCOUNTS" || (user.role === "ADMIN" && !superAdmin)) && <NavLink href="/accounts" icon={<ShieldIcon />}>Accounts</NavLink>}
          {(user.role === "APPROVER" || user.role === "ADMIN") && <NavLink href="/approver" icon={<ShieldIcon />}>Approvals</NavLink>}
          {superAdmin && <NavLink href="/admin" icon={<ShieldIcon />}>Admin</NavLink>}
          {(user.role === "ACCOUNTS" || user.role === "ADMIN") && <NavLink href="/reports" icon={<ChartIcon />}>Reports</NavLink>}
          <span className="col-span-2 inline-flex min-w-0 items-center gap-2 text-rdcGreen sm:col-span-1">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-rdcGreen bg-green-50 sm:h-9 sm:w-9"><UserIcon className="h-5 w-5" /></span>
            <span className="max-w-full truncate sm:max-w-[12rem]">{user.name}{superAdmin ? " (Superadmin)" : ""}</span>
          </span>
          <form action="/api/auth/logout" method="post" className="col-span-2 sm:col-span-1">
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-rdcGreen bg-white px-3 py-2 font-bold text-rdcGreen hover:bg-green-50 sm:w-auto sm:px-4">
              <LogoutIcon className="h-4 w-4" /> Logout
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-2 py-2 text-ink hover:text-rdcGreen sm:border-0 sm:px-0">{icon}{children}</Link>;
}

function RdcLogo() {
  return (
    <img
      src="/rdc-logo.jpeg"
      alt="RDC - We Promise We Deliver"
      className="h-10 w-auto shrink-0 object-contain sm:h-16"
    />
  );
}
