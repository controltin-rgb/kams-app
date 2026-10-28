import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type LocationType } from "../generated/prisma/client";
import { defaultAssetDesign, defaultLayout, defaultStatusTemplates } from "../modules/labels/defaults";
import { categories, departments, locations, vendors } from "./seed-data";
import { seedOffice3d } from "./seed-office3d-lib";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type SeedUser = { username: string; name: string; email: string; role: string; password: string };

async function upsertUser(u: SeedUser) {
  const existing = await prisma.user.findUnique({ where: { username: u.username } });
  if (existing) {
    console.log(`- "${u.username}" already exists, skipping`);
    return;
  }
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      name: u.name,
      email: u.email,
      emailVerified: true,
      username: u.username,
      displayUsername: u.username,
      role: u.role,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(u.password) },
      },
    },
  });
  console.log(`+ created "${u.username}" (${u.role})`);
}

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("SEED_ADMIN_PASSWORD is required");

  await upsertUser({
    username: process.env.SEED_ADMIN_USERNAME ?? "admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    name: "ผู้ดูแลระบบ",
    role: "admin",
    password,
  });

  // Development only: one account per role for permission testing (same password as admin)
  if (process.env.SEED_DEMO_USERS === "true") {
    const demo: Omit<SeedUser, "password">[] = [
      { username: "manager", name: "สมศรี ผู้จัดการ", email: "manager@example.com", role: "manager" },
      { username: "tech", name: "สมชาย ช่างเทคนิค", email: "tech@example.com", role: "technician" },
      { username: "auditor", name: "สมหญิง ผู้ตรวจนับ", email: "auditor@example.com", role: "auditor" },
      { username: "user", name: "สมปอง ผู้ใช้งาน", email: "user@example.com", role: "user" },
    ];
    for (const u of demo) await upsertUser({ ...u, password });
  }

  await seedCategories();
  await seedLabelTemplates();
  if (process.env.SEED_DEMO_DATA === "true") await seedDemoMasterData();
  await seedOffice3d(prisma);
}

// Asset categories with property definitions (always seeded; existing categories are left untouched)
async function seedCategories() {
  for (const c of categories) {
    const exists = await prisma.assetCategory.findUnique({ where: { codePrefix: c.codePrefix } });
    if (exists) continue;
    await prisma.assetCategory.create({
      data: {
        name: c.name,
        codePrefix: c.codePrefix,
        description: c.description,
        propertyDefs: {
          create: c.props.map((p, i) => ({ ...p, required: p.required ?? false, options: p.options ?? [], sortOrder: i })),
        },
      },
    });
    console.log(`+ category ${c.codePrefix} ${c.name}`);
  }
}

// Development only: sample departments, locations and vendors
async function seedDemoMasterData() {
  for (const name of departments) {
    await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }

  async function upsertLocation(node: { name: string; type: LocationType; children?: typeof locations }, parentId: string | null) {
    const existing = await prisma.location.findFirst({ where: { name: node.name, parentId, deletedAt: null } });
    const loc = existing ?? (await prisma.location.create({ data: { name: node.name, type: node.type, parentId } }));
    for (const child of node.children ?? []) await upsertLocation(child, loc.id);
  }
  for (const root of locations) await upsertLocation(root, null);

  for (const v of vendors) {
    const exists = await prisma.vendor.findFirst({ where: { name: v.name } });
    if (!exists) await prisma.vendor.create({ data: v });
  }
  console.log("+ demo departments, locations, vendors");
}

// Label templates: one asset label + five status stickers on A4 4×10 (only when none exist)
async function seedLabelTemplates() {
  if (await prisma.labelTemplate.count()) return;
  const layout = defaultLayout;
  await prisma.labelTemplate.create({
    data: { name: "ฉลากครุภัณฑ์ (A4 4×10)", kind: "ASSET", paperPreset: "A4_4x10", ...layout, design: { elements: defaultAssetDesign }, isDefault: true },
  });
  for (const t of defaultStatusTemplates) {
    await prisma.labelTemplate.create({ data: { name: t.name, kind: "STATUS", paperPreset: "A4_4x10", ...layout, design: { elements: t.design } } });
  }
  console.log("+ label templates");
}

main().finally(() => prisma.$disconnect());
