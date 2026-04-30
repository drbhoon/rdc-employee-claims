import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowedFileTypes } from "@/lib/constants";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const form = await request.formData();
  const claimLineId = String(form.get("claimLineId"));
  const file = form.get("file") as File | null;
  if (!file || !claimLineId) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 5);
  if (!allowedFileTypes.includes(file.type)) return NextResponse.json({ error: "Only PDF, JPG, JPEG and PNG are allowed" }, { status: 400 });
  if (file.size > maxMb * 1024 * 1024) return NextResponse.json({ error: `File exceeds ${maxMb}MB` }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  const stored = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  await prisma.claimAttachment.create({
    data: {
      claimLineId,
      fileName: file.name,
      fileUrl: `/api/attachments/${stored}`,
      fileType: file.type,
      fileSize: file.size,
      uploadedBy: user.employeeId
    }
  });
  const line = await prisma.claimLine.findUnique({ where: { id: claimLineId } });
  return NextResponse.redirect(new URL(`/claims/${line?.claimHeaderId}`, request.url));
}
