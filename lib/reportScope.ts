import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";

/**
 * Accounts users may report only on employees assigned to their Accounts
 * email. Users with an explicitly delegated national-report permission keep
 * the national scope.
 */
export function reportScopeWhere(user: Pick<SessionUser, "employeeId" | "role" | "email" | "canDownloadNationalReports">, nationalAccess: boolean): Prisma.ClaimHeaderWhereInput {
  if (nationalAccess) return {};
  if (user.role === "ACCOUNTS" && user.email) {
    return { employee: { accountsEmail: { equals: user.email, mode: "insensitive" } } };
  }
  return { history: { some: { action: "ACCOUNTS_PASS", actionByEmployeeId: user.employeeId } } };
}
