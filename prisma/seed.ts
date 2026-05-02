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
      passwordHash,
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
  await upsertUser({ employeeId: "ADMIN001", name: "System Admin", password: "Admin@123", role: "ADMIN", email: "admin@rdc.test" });
  await upsertUser({
    employeeId: "ACC001",
    name: "Accounts Verifier",
    password: "Accounts@123",
    role: "ACCOUNTS",
    email: "accounts.verifier@rdc.test",
    reportingManagerId: "RM001",
    level2ApproverId: "BHFH001",
    level3ApproverId: "COOCEO001"
  });
  await upsertUser({
    employeeId: "RM001",
    name: "Reporting Manager",
    password: "Manager@123",
    role: "APPROVER",
    email: "rm@rdc.test",
    reportingManagerId: "RM001",
    level2ApproverId: "BHFH001",
    level3ApproverId: "COOCEO001"
  });
  await upsertUser({
    employeeId: "BHFH001",
    name: "Business Functional Head",
    password: "Head@123",
    role: "APPROVER",
    email: "bhfh@rdc.test",
    reportingManagerId: "RM001",
    level2ApproverId: "BHFH001",
    level3ApproverId: "COOCEO001"
  });
  await upsertUser({
    employeeId: "COOCEO001",
    name: "COO CEO Approver",
    password: "Cooceo@123",
    role: "APPROVER",
    email: "cooceo@rdc.test",
    reportingManagerId: "RM001",
    level2ApproverId: "BHFH001",
    level3ApproverId: "COOCEO001"
  });
  await upsertUser({
    employeeId: "EMP001",
    name: "Demo Employee",
    password: "Employee@123",
    role: "EMPLOYEE",
    email: "employee@rdc.test",
    reportingManagerId: "RM001",
    level2ApproverId: "BHFH001",
    level3ApproverId: "COOCEO001"
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
      { minAmount: 0, maxAmount: 25000, requiresLevel1: true, requiresLevel2: true, requiresLevel3: false },
      { minAmount: 25000.01, maxAmount: null, requiresLevel1: true, requiresLevel2: true, requiresLevel3: true }
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
