import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { employeeExpenseTypes, expenseGlCodes } from "../lib/expenseTypes";

const prisma = new PrismaClient();
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "ksbhoon@rdc.in").trim().toLowerCase();

async function upsertUser(data: {
  employeeId: string;
  name: string;
  password: string;
  role: Role;
  email: string;
  accountsName?: string;
  accountsEmail?: string;
  rmName?: string;
  rmEmail?: string;
  level1Name?: string;
  level1Email?: string;
  level2Name?: string;
  level2Email?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.user.upsert({
    where: { employeeId: data.employeeId },
    update: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      accountsName: data.accountsName,
      accountsEmail: data.accountsEmail,
      rmName: data.rmName,
      rmEmail: data.rmEmail,
      level1Name: data.level1Name,
      level1Email: data.level1Email,
      level2Name: data.level2Name,
      level2Email: data.level2Email,
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
      accountsName: data.accountsName,
      accountsEmail: data.accountsEmail,
      rmName: data.rmName,
      rmEmail: data.rmEmail,
      level1Name: data.level1Name,
      level1Email: data.level1Email,
      level2Name: data.level2Name,
      level2Email: data.level2Email,
      isActive: true
    }
  });
}

async function main() {
  await ensureSuperadmin();

  if (process.env.SEED_DEMO_USERS === "true") {
    await upsertUser({ employeeId: "ADMIN001", name: "System Admin", password: "Admin@123", role: "ADMIN", email: "admin@rdc.test" });
    await upsertUser({
      employeeId: "ACC001",
      name: "Accounts Verifier",
      password: "Accounts@123",
      role: "ACCOUNTS",
      email: "accounts.verifier@rdc.test"
    });
    await upsertUser({
      employeeId: "RM001",
      name: "Reporting Manager",
      password: "Manager@123",
      role: "APPROVER",
      email: "rm@rdc.test"
    });
    await upsertUser({
      employeeId: "LVL1001",
      name: "Level1 Approver",
      password: "Level1@123",
      role: "APPROVER",
      email: "level1@rdc.test"
    });
    await upsertUser({
      employeeId: "LVL2001",
      name: "Level2 Approver",
      password: "Level2@123",
      role: "APPROVER",
      email: "level2@rdc.test"
    });
    await upsertUser({
      employeeId: "EMP001",
      name: "Demo Employee",
      password: "Employee@123",
      role: "EMPLOYEE",
      email: "employee@rdc.test",
      accountsName: "Accounts Verifier",
      accountsEmail: "accounts.verifier@rdc.test",
      rmName: "Reporting Manager",
      rmEmail: "rm@rdc.test",
      level1Name: "Level1 Approver",
      level1Email: "level1@rdc.test",
      level2Name: "Level2 Approver",
      level2Email: "level2@rdc.test"
    });
  }

  const claimTypes = employeeExpenseTypes;
  await migrateClaimTypes();
  for (const name of claimTypes) {
    await prisma.claimType.upsert({
      where: { name },
      update: { attachmentRequired: false, costHead: name, glCode: expenseGlCodes[name], isActive: true },
      create: {
        name,
        attachmentRequired: false,
        costHead: name,
        glCode: expenseGlCodes[name]
      }
    });
  }

  await prisma.approvalRule.deleteMany({});
  await prisma.approvalRule.createMany({
    data: [
      { minAmount: 0, maxAmount: 25000, requiresLevel1: true, requiresLevel2: false, requiresLevel3: false },
      { minAmount: 25000.01, maxAmount: null, requiresLevel1: true, requiresLevel2: true, requiresLevel3: false }
    ]
  });
}

async function ensureSuperadmin() {
  const existingEmailOwner = await prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL } });
  if (existingEmailOwner) {
    await prisma.user.update({
      where: { id: existingEmailOwner.id },
      data: {
        role: "ADMIN",
        isActive: true
      }
    });
    await prisma.user.updateMany({
      where: {
        employeeId: "SUPERADMIN",
        id: { not: existingEmailOwner.id }
      },
      data: {
        email: null,
        isActive: false
      }
    });
    return;
  }

  const existingSuperadmin = await prisma.user.findUnique({ where: { employeeId: "SUPERADMIN" } });
  if (existingSuperadmin) {
    await prisma.user.update({
      where: { employeeId: "SUPERADMIN" },
      data: {
        name: process.env.SUPERADMIN_NAME || "Superadmin",
        email: SUPERADMIN_EMAIL,
        role: "ADMIN",
        isActive: true,
        mustChangePassword: false
      }
    });
    return;
  }

  await upsertUser({
    employeeId: "SUPERADMIN",
    name: process.env.SUPERADMIN_NAME || "Superadmin",
    password: process.env.SUPERADMIN_PASSWORD || "Superadmin@123",
    role: "ADMIN",
    email: SUPERADMIN_EMAIL
  });
}

async function migrateClaimTypes() {
  const replacementName = "Sales Promotion Expenses & Customer Relations";
  const typoSales = await prisma.claimType.findUnique({ where: { name: "Sales Promotion Expenses & Custome Relations" } });
  const oldSales = await prisma.claimType.findUnique({ where: { name: "Sales Promotion Expenses" } });
  let newSales = await prisma.claimType.findUnique({ where: { name: replacementName } });
  if (typoSales && !newSales) {
    await prisma.claimType.update({
      where: { id: typoSales.id },
      data: {
        name: replacementName,
        costHead: replacementName,
        glCode: expenseGlCodes[replacementName],
        isActive: true
      }
    });
    newSales = await prisma.claimType.findUnique({ where: { name: replacementName } });
  } else if (typoSales && newSales) {
    await deleteOrDeactivateClaimType(typoSales.id);
  }
  if (oldSales && !newSales) {
    await prisma.claimType.update({
      where: { id: oldSales.id },
      data: {
        name: replacementName,
        costHead: replacementName,
        glCode: expenseGlCodes[replacementName],
        isActive: true
      }
    });
  } else if (oldSales && newSales) {
    await deleteOrDeactivateClaimType(oldSales.id);
  }

  const obsoleteTypes = [
    "Customer Relation (Lunch & Dinner with Customer)",
    "Customer Relations (Lunch & Dinner with customer)",
    "Food / Meal Expense",
    "Fuel Reimbursement",
    "Hotel Stay",
    "Local Conveyance",
    "Local Conveyance (Local Visit as per RDC Track)",
    "Medical Reimbursement",
    "Miscellaneous",
    "Mobile Reimbursement",
    "Office Maintanance (Sweeper salary, Other)",
    "Repair and Maintainance (Less than 5K)",
    "Staff Welfare",
    "Toll / Parking",
    "Travel Expense",
    "Travelling Expenses Outstation visits (e.g., Hotel stay, Train fare, Air fare, bus fare)"
  ];

  for (const name of obsoleteTypes) {
    const type = await prisma.claimType.findUnique({ where: { name } });
    if (type) await deleteOrDeactivateClaimType(type.id);
  }
}

async function deleteOrDeactivateClaimType(id: string) {
  const lineCount = await prisma.claimLine.count({ where: { claimTypeId: id } });
  if (lineCount) {
    await prisma.claimType.update({ where: { id }, data: { isActive: false } });
    return;
  }
  await prisma.claimType.delete({ where: { id } });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
