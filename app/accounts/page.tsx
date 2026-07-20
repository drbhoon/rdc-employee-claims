import { ClaimTable } from "@/components/ClaimTable";
import { Shell } from "@/components/Shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountsPage() {
  const user = await requireUser(["ACCOUNTS", "ADMIN"]);
  const claims = await prisma.claimHeader.findMany({
    where: user.role === "ADMIN" ? undefined : { employee: { accountsEmail: user.email || "" } },
    orderBy: { updatedAt: "desc" }
  });
  const groups = [
    ["Pending Accounts Audit", "Claims currently requiring action from Accounts.", ["SUBMITTED_TO_ACCOUNTS"]],
    ["Under Approval / Tracking", "Claims passed by Accounts and currently awaiting RM or approver action. These are read-only for Accounts.", ["PASSED_BY_ACCOUNTS", "PENDING_LEVEL_1_APPROVAL", "PENDING_LEVEL_2_APPROVAL", "PENDING_LEVEL_3_APPROVAL"]],
    ["Final Approved", "Claims that completed the approval workflow. No further Accounts action is required.", ["FINAL_APPROVED"]],
    ["Returned by Accounts", "Claims returned to employees for correction.", ["RETURNED_BY_ACCOUNTS"]],
    ["Rejected by Accounts", "Claims rejected during Accounts audit.", ["REJECTED_BY_ACCOUNTS"]]
  ] as const;
  return (
    <Shell title="Accounts Dashboard">
      <div className="space-y-6">
        {groups.map(([title, description, statuses]) => (
          <section key={title}>
            <h2 className="font-semibold">{title}</h2>
            <p className="mb-2 text-sm text-muted">{description}</p>
            <ClaimTable claims={claims.filter((c) => statuses.includes(c.currentStatus as never))} />
          </section>
        ))}
      </div>
    </Shell>
  );
}
