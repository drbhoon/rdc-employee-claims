import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { recoverablePendingStatuses } from "@/lib/pendingClaimRecovery";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: "Only superadmin can search pending claims." }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return NextResponse.json({ error: "Enter at least 2 characters of Employee Code or Employee Name." }, { status: 400 });

  const claims = await prisma.claimHeader.findMany({
    where: {
      currentStatus: { in: recoverablePendingStatuses },
      OR: [
        { employeeId: { contains: query, mode: "insensitive" } },
        { employeeName: { contains: query, mode: "insensitive" } }
      ]
    },
    select: {
      id: true, claimId: true, employeeId: true, employeeName: true, totalAmount: true,
      currentStatus: true, currentPendingWith: true, submittedAt: true,
      lines: { select: { attachments: { select: { id: true } } } }
    },
    orderBy: { submittedAt: "desc" },
    take: 25
  });

  return NextResponse.json({
    claims: claims.map((claim) => ({
      id: claim.id,
      claimId: claim.claimId,
      employeeId: claim.employeeId,
      employeeName: claim.employeeName,
      totalAmount: String(claim.totalAmount),
      currentStatus: claim.currentStatus,
      currentPendingWith: claim.currentPendingWith,
      submittedAt: claim.submittedAt?.toISOString() || null,
      attachmentCount: claim.lines.reduce((count, line) => count + line.attachments.length, 0)
    }))
  });
}
