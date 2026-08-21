import { unlink } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { isRecoverablePendingStatus } from "@/lib/pendingClaimRecovery";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !isSuperAdmin(session)) return NextResponse.json({ error: "Only superadmin can delete pending claims." }, { status: 403 });

  const claim = await prisma.claimHeader.findUnique({
    where: { id: params.id },
    include: { lines: { include: { attachments: { select: { fileUrl: true } } } } }
  });
  if (!claim) return NextResponse.json({ error: "Claim was not found or was already deleted." }, { status: 404 });
  if (!isRecoverablePendingStatus(claim.currentStatus)) {
    return NextResponse.json({ error: `Claim ${claim.claimId} is ${claim.currentStatus} and is protected from deletion.` }, { status: 409 });
  }

  const storedFiles = claim.lines.flatMap((line) => line.attachments.map((attachment) => attachment.fileUrl));
  try {
    await prisma.claimHeader.delete({ where: { id: claim.id } });
  } catch (error) {
    console.error("Pending claim recovery database deletion failed", {
      claimId: claim.claimId,
      employeeId: claim.employeeId,
      currentStatus: claim.currentStatus,
      deletedBy: session.employeeId,
      error
    });
    return NextResponse.json({ error: `Unable to delete ${claim.claimId} from the database. No claim data was removed. Please share the server log with support.` }, { status: 500 });
  }
  const failedFiles: string[] = [];
  for (const fileUrl of storedFiles) {
    const storedName = path.basename(fileUrl);
    try {
      await unlink(path.join(process.cwd(), "uploads", storedName));
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
      if (code !== "ENOENT") failedFiles.push(storedName);
    }
  }

  console.warn("Superadmin deleted pending claim for recovery", {
    claimId: claim.claimId,
    employeeId: claim.employeeId,
    previousStatus: claim.currentStatus,
    deletedBy: session.employeeId,
    attachmentFiles: storedFiles.length,
    failedFileDeletes: failedFiles
  });
  for (const appPath of ["/admin", "/dashboard", "/accounts", "/approver", "/reports"]) revalidatePath(appPath);
  return NextResponse.json({ deletedClaimId: claim.claimId, deletedAttachments: storedFiles.length, failedFileDeletes: failedFiles.length });
}
