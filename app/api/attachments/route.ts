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
  const line = await prisma.claimLine.findUnique({ where: { id: claimLineId } });
  const claimPath = line?.claimHeaderId ? `/claims/${line.claimHeaderId}` : "/dashboard";
  const maxMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 5);
  if (!allowedFileTypes.includes(file.type)) return NextResponse.redirect(new URL(`${claimPath}?error=${encodeURIComponent("Supporting document upload: only PDF, JPG, JPEG and PNG files are allowed.")}`, request.url));
  if (file.size > maxMb * 1024 * 1024) return NextResponse.redirect(new URL(`${claimPath}?error=${encodeURIComponent(`Supporting document upload: file is ${(file.size / 1024 / 1024).toFixed(2)} MB. Please compress it below ${maxMb} MB and upload again.`)}`, request.url));
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
  return NextResponse.redirect(new URL(`/claims/${line?.claimHeaderId}`, request.url));
}
