import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: { file: string } }) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const safeName = path.basename(params.file);
  const bytes = await readFile(path.join(process.cwd(), "uploads", safeName));
  return new NextResponse(bytes);
}
