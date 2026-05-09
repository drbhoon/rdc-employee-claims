import { buildTemplateWorkbook } from "@/lib/employeeUpload";
import { getSession, isSuperAdmin } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return new Response("Only superadmin can download the employee master template.", { status: 403 });
  return new Response(buildTemplateWorkbook(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"employee-upload-template.xlsx\""
    }
  });
}
