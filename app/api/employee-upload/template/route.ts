import { buildTemplateWorkbook } from "@/lib/employeeUpload";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });
  return new Response(buildTemplateWorkbook(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"employee-upload-template.xlsx\""
    }
  });
}
