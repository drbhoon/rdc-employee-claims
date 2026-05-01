import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { employeeExpenseTypes } from "../lib/expenseTypes";

const prisma = new PrismaClient();

async function upsertUser(data: {
  employeeId: string;
  name: string;
  password: string;
  role: Role;
  email: string;
  reportingManagerId?: string;
  level2ApproverId?: string;
  level3ApproverId?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.user.upsert({
    where: { employeeId: data.employeeId },
    update: {
      name: data.name,
      email: data.email,
      role: data.role,
      reportingManagerId: data.reportingManagerId,
      level2ApproverId: data.level2ApproverId,
      level3ApproverId: data.level3ApproverId,
      isActive: true
    },
    create: {
      employeeId: data.employeeId,
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      department: data.role === "ACCOUNTS" ? "Finance" : "Operations",
      location: "Mumbai",
      plant: "Plant A",
      costCenter: data.role === "ACCOUNTS" ? "FIN100" : "OPS100",
      reportingManagerId: data.reportingManagerId,
      level2ApproverId: data.level2ApproverId,
      level3ApproverId: data.level3ApproverId,
      isActive: true
    }
  });
}

async function main() {
  await upsertUser({ employeeId: "ADMIN001", name: "System Admin", password: "Admin@123", role: "ADMIN", email: "admin@example.com" });
  await upsertUser({ employeeId: "ACC001", name: "Accounts User", password: "Accounts@123", role: "ACCOUNTS", email: "accounts@example.com" });
  await upsertUser({ employeeId: "MGR001", name: "Reporting Manager", password: "Manager@123", role: "APPROVER", email: "manager@example.com" });
  await upsertUser({ employeeId: "HOD001", name: "HOD Approver", password: "Hod@123", role: "APPROVER", email: "hod@example.com" });
  await upsertUser({ employeeId: "DIR001", name: "Director Approver", password: "Director@123", role: "APPROVER", email: "director@example.com" });
  await upsertUser({
    employeeId: "EMP001",
    name: "Demo Employee",
    password: "Employee@123",
    role: "EMPLOYEE",
    email: "employee@example.com",
    reportingManagerId: "MGR001",
    level2ApproverId: "HOD001",
    level3ApproverId: "DIR001"
  });

  const claimTypes = employeeExpenseTypes;
  for (const name of claimTypes) {
    await prisma.claimType.upsert({
      where: { name },
      update: { attachmentRequired: false, isActive: true },
      create: {
        name,
        attachmentRequired: false,
        costHead: name,
        glCode: `GL-${name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "")}`
      }
    });
  }

  await prisma.approvalRule.deleteMany({});
  await prisma.approvalRule.createMany({
    data: [
      { minAmount: 0, maxAmount: 2000, requiresLevel1: true, requiresLevel2: false, requiresLevel3: false },
      { minAmount: 2001, maxAmount: 10000, requiresLevel1: true, requiresLevel2: true, requiresLevel3: false },
      { minAmount: 10001, maxAmount: null, requiresLevel1: true, requiresLevel2: true, requiresLevel3: true }
    ]
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
