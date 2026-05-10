import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const columns = [
  "employee_id",
  "employee_name",
  "login_id",
  "role",
  "mobile",
  "department",
  "location",
  "plant",
  "cost_center",
  "accounts_name",
  "accounts_email",
  "rm_name",
  "rm_email",
  "level1_name",
  "level1_email",
  "level2_name",
  "level2_email",
  "is_active"
];

export async function GET() {
  const user = await getSession();
  if (!user || !isSuperAdmin(user)) return new Response("Only superadmin can download employee master data.", { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { employeeId: "asc" },
    select: {
      employeeId: true,
      name: true,
      email: true,
      role: true,
      mobile: true,
      department: true,
      location: true,
      plant: true,
      costCenter: true,
      accountsName: true,
      accountsEmail: true,
      rmName: true,
      rmEmail: true,
      level1Name: true,
      level1Email: true,
      level2Name: true,
      level2Email: true,
      isActive: true
    }
  });

  const rows = users.map((item) => [
    item.employeeId,
    item.name,
    item.email || "",
    item.role,
    item.mobile || "",
    item.department || "",
    item.location || "",
    item.plant || "",
    item.costCenter || "",
    item.accountsName || "",
    item.accountsEmail || "",
    item.rmName || "",
    item.rmEmail || "",
    item.level1Name || "",
    item.level1Email || "",
    item.level2Name || "",
    item.level2Email || "",
    String(item.isActive)
  ]);

  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"employee-master.csv\""
    }
  });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
