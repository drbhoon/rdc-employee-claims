import { readFile } from "fs/promises";
import path from "path";
import { getSession, isSuperAdmin } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return new Response("Only Superadmin can download the volume template.", { status: 403 });
  const file = await readFile(path.join(process.cwd(), "public", "templates", "volume-upload-template.xlsx"));
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=monthly-sales-volume-template.xlsx"
    }
  });
}
