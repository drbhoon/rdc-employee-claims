import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseByteRange } from "@/lib/httpRange";

export const runtime = "nodejs";

const mimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};

export async function GET(request: Request, { params }: { params: { file: string } }) {
  const requestedAt = Date.now();
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const authenticatedAt = Date.now();

  const safeName = path.basename(params.file);
  const filePath = path.join(process.cwd(), "uploads", safeName);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return new NextResponse("Attachment not found", { status: 404 });
  }
  if (!fileStat.isFile()) return new NextResponse("Attachment not found", { status: 404 });

  const contentType = mimeTypes[path.extname(safeName).toLowerCase()] || "application/octet-stream";
  if (fileStat.size === 0) {
    return new NextResponse(null, { headers: { "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600", "Content-Length": "0", "Content-Type": contentType } });
  }

  const range = parseByteRange(request.headers.get("range"), fileStat.size);
  if (range === "invalid") {
    return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${fileStat.size}`, "Accept-Ranges": "bytes" } });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? fileStat.size - 1;
  const contentLength = Math.max(end - start + 1, 0);
  const nodeStream = createReadStream(filePath, range ? { start, end } : undefined);
  const streamStartedAt = Date.now();
  nodeStream.once("end", () => {
    console.info("Attachment stream completed", {
      file: safeName,
      fileSize: fileStat.size,
      bytesSent: contentLength,
      rangeRequest: Boolean(range),
      authenticationMs: authenticatedAt - requestedAt,
      streamStartMs: streamStartedAt - requestedAt,
      totalMs: Date.now() - requestedAt
    });
  });
  nodeStream.once("error", (error) => {
    console.error("Attachment stream failed", { file: safeName, rangeRequest: Boolean(range), error });
  });
  const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `inline; filename="${safeName.replace(/["\\]/g, "_")}"`,
    "Content-Length": String(contentLength),
    "Content-Type": contentType
  });
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);

  return new NextResponse(body, { status: range ? 206 : 200, headers });
}
