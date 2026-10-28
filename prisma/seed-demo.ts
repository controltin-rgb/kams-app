// Demo dataset for development: 50 registered assets plus everything that hangs off them
// (holders, bundles, handover documents, tickets, PM plans, vendor claims, stock takes, notifications, audit trail).
// Run with `pnpm db:seed:demo`. Safe to run twice: it stops when the marker setting already exists.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import {
  Prisma,
  PrismaClient,
  type AssetCondition,
  type AssetStatus,
  type LocationType,
  type PmFrequency,
  type PmRunStatus,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "../generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
type Tx = Prisma.TransactionClient;

const MARKER = "demo.dataset";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = new Date();
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * HOUR);
const ahead = (days: number) => new Date(now.getTime() + days * DAY);
/** Midnight UTC of the Bangkok calendar day offset from today, for @db.Date columns */
const dateOnly = (d: Date) => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d)}T00:00:00.000Z`);
const addMonths = (d: Date, m: number) => {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + m);
  return r;
};
const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(now));

async function seq(tx: Tx, key: string, count = 1): Promise<number> {
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "DocumentSequence" ("key", "year", "last") VALUES (${key}, ${year}, ${count})
    ON CONFLICT ("key", "year") DO UPDATE SET "last" = "DocumentSequence"."last" + ${count}
    RETURNING "last"`;
  return rows[0].last - count + 1;
}
const num = (prefix: string, n: number) => `${prefix}-${year}-${String(n).padStart(4, "0")}`;

// ---------- Master data ----------
const departmentNames = ["ฝ่ายบริหาร", "ฝ่ายบุคคล", "ฝ่ายบัญชีและการเงิน", "ฝ่ายเทคโนโลยีสารสนเทศ", "ฝ่ายอาคารสถานที่"];
const locationTree: { path: string[]; type: LocationType }[] = [
  { path: ["อาคาร A (สำนักงานใหญ่)"], type: "BUILDING" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 1"], type: "FLOOR" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 1", "ห้อง 101 ฝ่ายบุคคล"], type: "ROOM" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 1", "ห้อง 102 ฝ่ายบัญชี"], type: "ROOM" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 1", "ห้อง Server"], type: "ROOM" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 2"], type: "FLOOR" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 2", "ห้อง 201 ฝ่ายไอที"], type: "ROOM" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 2", "ห้องประชุม 1"], type: "ROOM" },
  { path: ["อาคาร A (สำนักงานใหญ่)", "ชั้น 2", "ห้องผู้บริหาร"], type: "ROOM" },
  { path: ["อาคาร B"], type: "BUILDING" },
  { path: ["อาคาร B", "ชั้น 1"], type: "FLOOR" },
  { path: ["อาคาร B", "ชั้น 1", "คลังพัสดุ"], type: "ROOM" },
  { path: ["อาคาร B", "ชั้น 1", "ห้องช่าง"], type: "ROOM" },
];
const extraVendors = [
  { name: "บริษัท ตัวอย่าง เน็ตเวิร์ค โซลูชั่น จำกัด", contact: "ฝ่ายเทคนิค", phone: "02-000-0003", email: "network@example.com" },
  { name: "บริษัท ตัวอย่าง แอร์ แอนด์ คูลลิ่ง จำกัด", contact: "ฝ่ายบริการหลังการขาย", phone: "02-000-0004", email: "cooling@example.com" },
];

const holderSpecs = [
  { username: "s.nattaya", name: "ณัฐยา ใจดี", dept: 2, loc: "ห้อง 102 ฝ่ายบัญชี" },
  { username: "s.wichai", name: "วิชัย รุ่งเรือง", dept: 2, loc: "ห้อง 102 ฝ่ายบัญชี" },
  { username: "s.preeya", name: "ปรียา สุขสันต์", dept: 1, loc: "ห้อง 101 ฝ่ายบุคคล" },
  { username: "s.anan", name: "อนันต์ เก่งกล้า", dept: 3, loc: "ห้อง 201 ฝ่ายไอที" },
  { username: "s.kittisak", name: "กิตติศักดิ์ มั่นคง", dept: 3, loc: "ห้อง 201 ฝ่ายไอที" },
  { username: "s.malee", name: "มาลี ศรีสุข", dept: 0, loc: "ห้องผู้บริหาร" },
  { username: "s.somsak", name: "สมศักดิ์ ช่างดี", dept: 4, loc: "ห้องช่าง" },
  { username: "s.pimchanok", name: "พิมพ์ชนก แก้วใส", dept: 0, loc: "ห้องผู้บริหาร" },
  { username: "s.thanawat", name: "ธนวัฒน์ พงษ์พันธ์", dept: 2, loc: "ห้อง 102 ฝ่ายบัญชี" },
];

// ---------- Asset catalogue (50 items) ----------
type Model = { name: string; brand: string; model: string; cost: number };
const catalogue: Record<string, Model[]> = {
  PC: [
    { name: "คอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex", brand: "Dell", model: "OptiPlex 7010", cost: 28900 },
    { name: "คอมพิวเตอร์ตั้งโต๊ะ HP ProDesk", brand: "HP", model: "ProDesk 400 G9", cost: 24500 },
    { name: "คอมพิวเตอร์ตั้งโต๊ะ Lenovo ThinkCentre", brand: "Lenovo", model: "ThinkCentre M70s", cost: 25900 },
  ],
  NB: [
    { name: "โน้ตบุ๊ก Lenovo ThinkPad", brand: "Lenovo", model: "ThinkPad E14 Gen 5", cost: 27900 },
    { name: "โน้ตบุ๊ก HP ProBook", brand: "HP", model: "ProBook 450 G10", cost: 31900 },
    { name: "โน้ตบุ๊ก Dell Latitude", brand: "Dell", model: "Latitude 3440", cost: 29900 },
    { name: "โน้ตบุ๊ก Acer Aspire", brand: "Acer", model: "Aspire 5 A515", cost: 21900 },
  ],
  AIO: [
    { name: "All-in-One HP 24", brand: "HP", model: "24-cb1000", cost: 26900 },
    { name: "All-in-One Lenovo IdeaCentre", brand: "Lenovo", model: "IdeaCentre AIO 3", cost: 24900 },
  ],
  MON: [
    { name: 'จอภาพ Dell 24"', brand: "Dell", model: "P2422H", cost: 6290 },
    { name: 'จอภาพ LG 27"', brand: "LG", model: "27UL500", cost: 9900 },
    { name: 'จอภาพ AOC 24"', brand: "AOC", model: "24B2XH", cost: 3990 },
  ],
  PRT: [
    { name: "เครื่องพิมพ์เลเซอร์ HP", brand: "HP", model: "LaserJet Pro M404dn", cost: 11900 },
    { name: "เครื่องพิมพ์เลเซอร์ Brother", brand: "Brother", model: "HL-L2370DN", cost: 5990 },
    { name: "เครื่องพิมพ์อิงค์เจ็ท Epson", brand: "Epson", model: "L3250", cost: 5290 },
    { name: "เครื่องพิมพ์มัลติฟังก์ชัน Canon", brand: "Canon", model: "imageCLASS MF445dw", cost: 16900 },
    { name: "เครื่องพิมพ์ดอทเมทริกซ์ Epson", brand: "Epson", model: "LQ-310", cost: 7900 },
    { name: "เครื่องพิมพ์ฉลาก Zebra", brand: "Zebra", model: "ZD230", cost: 9500 },
  ],
  NET: [
    { name: "Switch Cisco 24 พอร์ต", brand: "Cisco", model: "CBS350-24T", cost: 22500 },
    { name: "Switch TP-Link 24 พอร์ต", brand: "TP-Link", model: "TL-SG3428", cost: 7900 },
    { name: "Access Point Ubiquiti", brand: "Ubiquiti", model: "UniFi U6-Pro", cost: 6900 },
    { name: "Firewall Fortinet", brand: "Fortinet", model: "FortiGate 60F", cost: 38000 },
    { name: "Router MikroTik", brand: "MikroTik", model: "RB4011", cost: 7400 },
    { name: "Access Point Aruba", brand: "Aruba", model: "Instant On AP22", cost: 5900 },
  ],
  UPS: [
    { name: "เครื่องสำรองไฟ APC", brand: "APC", model: "SMT1500I", cost: 15900 },
    { name: "เครื่องสำรองไฟ Eaton", brand: "Eaton", model: "5E 1100i", cost: 6990 },
    { name: "เครื่องสำรองไฟ APC", brand: "APC", model: "BX1100LI-MS", cost: 4590 },
  ],
  AC: [
    { name: "เครื่องปรับอากาศ Daikin 18,000 BTU", brand: "Daikin", model: "FTKM18", cost: 24900 },
    { name: "เครื่องปรับอากาศ Mitsubishi Heavy 24,000 BTU", brand: "Mitsubishi Heavy", model: "SRK24", cost: 31900 },
    { name: "เครื่องปรับอากาศ Carrier 12,000 BTU", brand: "Carrier", model: "42TVAB013", cost: 15900 },
  ],
};
const counts: Record<string, number> = { PC: 8, NB: 8, AIO: 2, MON: 10, PRT: 6, NET: 6, UPS: 4, AC: 6 }; // = 50
const btuOf = [18000, 24000, 12000, 18000, 12000, 24000];
const capacityOf = [1500, 1100, 1100, 1100];

function propsFor(prefix: string, i: number, m: Model): Record<string, string> {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  const mac = `00:1A:2B:${hex(10 + i)}:${hex(60 + i)}:${hex(200 - i)}`;
  switch (prefix) {
    case "PC":
    case "AIO":
    case "NB":
      return {
        cpu: i % 2 ? "Intel Core i7-13700" : "Intel Core i5-13500",
        ram_gb: i % 3 === 0 ? "32" : "16",
        storage: i % 2 ? "SSD 1TB" : "SSD 512GB",
        os: "Windows 11",
        ip: `192.168.10.${20 + i + (prefix === "NB" ? 40 : prefix === "AIO" ? 80 : 0)}`,
        mac,
        ...(prefix === "NB" ? { screen_inch: i % 2 ? "15.6" : "14" } : {}),
      };
    case "MON":
      return { size_inch: m.model === "27UL500" ? "27" : "24", resolution: m.model === "27UL500" ? "3840x2160" : "1920x1080", ports: "HDMI, DisplayPort" };
    case "PRT": {
      const kind = ["Laser", "Laser", "Inkjet", "Laser", "Dot Matrix", "Thermal"][i];
      return { printer_type: kind, color: i === 2 || i === 3 ? "true" : "false", network: i === 4 || i === 5 ? "false" : "true", ...(i === 4 || i === 5 ? {} : { ip: `192.168.20.${10 + i}` }) };
    }
    case "NET":
      return {
        device_type: ["Switch", "Switch", "Access Point", "Firewall", "Router", "Access Point"][i],
        ports: ["24", "24", "2", "6", "10", "2"][i],
        ip: `192.168.1.${2 + i}`,
        mac,
      };
    case "UPS":
      return { capacity_va: String(capacityOf[i]), battery_replaced: new Date(ago(200 + i * 90)).toISOString().slice(0, 10) };
    default:
      return { btu: String(btuOf[i]), ac_type: ["ติดผนัง", "ติดผนัง", "ติดผนัง", "แขวนใต้ฝ้า", "ติดผนัง", "ตั้งพื้น"][i], inverter: i % 2 ? "false" : "true", refrigerant: i % 2 ? "R32" : "R410A" };
  }
}

// Purchase age in days (default spreads purchases over the last ~3 years); overrides shape warranty dashboards
const ageOverride: Record<string, number> = {
  "NB-1": 3 * 365 - 12, // warranty (3y) ends in 12 days
  "UPS-1": 3 * 365 - 25,
  "MON-2": 3 * 365 - 5,
  "UPS-2": 4 * 365 + 60, // warranty already over
  "NET-2": 4 * 365 + 20,
  "PRT-5": 400, // under warranty → claim
  "MON-6": 500,
  "NET-1": 3 * 365 - 28,
};

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error("SEED_ADMIN_PASSWORD is required (used as the demo users' password)");
  if (await prisma.systemSetting.findUnique({ where: { key: MARKER } })) {
    console.log("Demo dataset already present, nothing to do.");
    return;
  }
  const byName = async (username: string) => {
    const u = await prisma.user.findUnique({ where: { username } });
    if (!u) throw new Error(`User "${username}" is missing. Run the base seed with SEED_DEMO_USERS=true first.`);
    return u;
  };
  const [admin, manager, tech, auditor, plainUser] = await Promise.all(["admin", "manager", "tech", "auditor", "user"].map(byName));
  const categories = await prisma.assetCategory.findMany({ include: { propertyDefs: true } });
  const cat = (prefix: string) => {
    const c = categories.find((x) => x.codePrefix === prefix);
    if (!c) throw new Error(`Category ${prefix} is missing. Run the base seed first.`);
    return c;
  };

  await prisma.$transaction(
    async (tx) => {
      // ----- departments, locations, vendors -----
      const dept = [] as { id: string; name: string }[];
      for (const name of departmentNames) dept.push(await tx.department.upsert({ where: { name }, update: {}, create: { name } }));

      const locId = new Map<string, string>(); // leaf name → id
      const pathId = new Map<string, string>();
      for (const n of locationTree) {
        const parentKey = n.path.slice(0, -1).join("/");
        const parentId = parentKey ? (pathId.get(parentKey) ?? null) : null;
        const name = n.path[n.path.length - 1];
        const found = await tx.location.findFirst({ where: { name, parentId, deletedAt: null } });
        const loc = found ?? (await tx.location.create({ data: { name, type: n.type, parentId } }));
        pathId.set(n.path.join("/"), loc.id);
        locId.set(name, loc.id);
      }
      const buildingA = pathId.get("อาคาร A (สำนักงานใหญ่)")!;
      const buildingB = pathId.get("อาคาร B")!;
      const L = (name: string) => locId.get(name)!;

      for (const v of extraVendors) if (!(await tx.vendor.findFirst({ where: { name: v.name } }))) await tx.vendor.create({ data: v });
      const vendors = await tx.vendor.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" } });
      const vendorBy = (kw: string) => vendors.find((v) => v.name.includes(kw)) ?? vendors[0];

      // ----- holders -----
      const holders: { id: string; name: string; deptId: string; locId: string }[] = [
        { id: plainUser.id, name: plainUser.name, deptId: dept[1].id, locId: L("ห้อง 101 ฝ่ายบุคคล") },
      ];
      const passwordHash = await hashPassword(adminPassword);
      for (const h of holderSpecs) {
        const id = randomUUID();
        await tx.user.create({
          data: {
            id,
            name: h.name,
            email: `${h.username.replace(".", "-")}@example.com`,
            emailVerified: true,
            username: h.username,
            displayUsername: h.username,
            role: "user",
            departmentId: dept[h.dept].id,
            accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: passwordHash } },
          },
        });
        holders.push({ id, name: h.name, deptId: dept[h.dept].id, locId: L(h.loc) });
      }
      console.log(`+ ${holderSpecs.length} staff accounts (password = SEED_ADMIN_PASSWORD)`);

      // ----- assets -----
      type A = {
        id: string;
        code: string;
        prefix: string;
        i: number;
        name: string;
        createdAt: Date;
        status: AssetStatus;
        ownerId: string | null;
        locationId: string | null;
        departmentId: string | null;
        serial: string;
        cost: number;
        purchase: Date;
      };
      const assets: Record<string, A[]> = {};
      const holderOf: Record<string, number> = {}; // "PC-0" → holder index
      // Who holds what (index into holders). PC0-6 and NB0-6 are personal; AIO0 too.
      for (let i = 0; i < 7; i++) holderOf[`PC-${i}`] = i;
      for (let i = 0; i < 7; i++) holderOf[`NB-${i}`] = (i + 4) % holders.length;
      holderOf["AIO-0"] = 7;
      // Shared equipment: location only
      const sharedLoc: Record<string, string> = {
        "PRT-0": "ห้อง 101 ฝ่ายบุคคล", "PRT-1": "ห้อง 102 ฝ่ายบัญชี", "PRT-2": "ห้องผู้บริหาร", "PRT-3": "ห้อง 201 ฝ่ายไอที", "PRT-4": "ห้องช่าง", "PRT-5": "ห้อง 102 ฝ่ายบัญชี",
        "NET-0": "ห้อง Server", "NET-1": "ห้อง Server", "NET-2": "ห้อง Server", "NET-3": "ห้อง Server", "NET-4": "ห้อง Server", "NET-5": "คลังพัสดุ",
        "UPS-0": "ห้อง Server", "UPS-1": "ห้อง Server", "UPS-2": "ห้อง 101 ฝ่ายบุคคล", "UPS-3": "ห้อง 102 ฝ่ายบัญชี",
        "AC-0": "ห้องประชุม 1", "AC-1": "ห้อง 201 ฝ่ายไอที", "AC-2": "ห้อง 101 ฝ่ายบุคคล", "AC-3": "ห้อง 102 ฝ่ายบัญชี", "AC-4": "ห้องผู้บริหาร", "AC-5": "ห้อง Server",
        "PC-7": "คลังพัสดุ", "AIO-1": "คลังพัสดุ", "MON-6": "คลังพัสดุ", "MON-7": "คลังพัสดุ", "MON-8": "คลังพัสดุ", "MON-9": "คลังพัสดุ", "NB-7": "คลังพัสดุ",
      };
      const finalStatus: Record<string, AssetStatus> = {
        "PC-6": "IN_MAINTENANCE", "NB-6": "IN_MAINTENANCE", "PRT-4": "IN_MAINTENANCE", "AC-5": "IN_MAINTENANCE",
        "MON-6": "CLAIMING", "PRT-5": "CLAIMING",
        "PC-7": "SPARE", "AIO-1": "SPARE", "MON-7": "SPARE", "MON-8": "SPARE", "NET-5": "SPARE",
        "MON-9": "PENDING_DISPOSAL", "NB-7": "DISPOSED",
      };
      const conditionOf: Record<string, AssetCondition> = { "MON-9": "DAMAGED", "NB-7": "DAMAGED", "UPS-3": "FAIR", "PC-6": "FAIR", "PRT-4": "FAIR" };

      let serialNo = 7_000;
      for (const [prefix, n] of Object.entries(counts)) {
        const c = cat(prefix);
        const first = await seq(tx, `ASSET:${prefix}`, n);
        assets[prefix] = [];
        for (let i = 0; i < n; i++) {
          const key = `${prefix}-${i}`;
          const m = catalogue[prefix][i % catalogue[prefix].length];
          const age = ageOverride[key] ?? 60 + ((i * 97 + prefix.length * 41) % 900);
          const purchase = dateOnly(ago(age));
          const holderIdx = holderOf[key];
          const holder = holderIdx === undefined ? null : holders[holderIdx];
          const locationId = holder ? holder.locId : (locId.get(sharedLoc[key] ?? "") ?? null);
          const departmentId = holder ? holder.deptId : prefix === "AC" || key === "PRT-4" ? dept[4].id : prefix === "NET" || prefix === "UPS" ? dept[3].id : null;
          const status: AssetStatus = finalStatus[key] ?? (holder ? "IN_USE" : "ACTIVE");
          const createdAt = new Date(Math.min(purchase.getTime() + 3 * DAY, now.getTime() - 40 * DAY));
          const serial = `SN${prefix}${String(++serialNo)}`;
          const cost = m.cost;
          const a = await tx.asset.create({
            data: {
              assetCode: num(prefix, first + i),
              name: m.name,
              categoryId: c.id,
              brand: m.brand,
              model: m.model,
              serialNumber: serial,
              purchaseDate: purchase,
              warrantyExpiry: dateOnly(addMonths(purchase, 36)),
              cost: new Prisma.Decimal(cost),
              status,
              condition: conditionOf[key] ?? "GOOD",
              ownerId: holder?.id ?? null,
              departmentId,
              locationId,
              note: key === "NB-7" ? "จอแตก ซ่อมไม่คุ้มค่า จำหน่ายออกแล้ว" : key === "MON-9" ? "แผงจอเสีย รอขออนุมัติจำหน่าย" : null,
              createdAt,
              properties: {
                create: Object.entries(propsFor(prefix, i, m))
                  .filter(([k]) => c.propertyDefs.some((d) => d.key === k))
                  .map(([k, value]) => ({ key: k, value })),
              },
            },
          });
          await tx.assetHistory.create({
            data: { assetId: a.id, event: "CREATED", toValue: { assetCode: a.assetCode, status: "SPARE" }, actorId: admin.id, createdAt },
          });
          await tx.systemAuditLog.create({
            data: { userId: admin.id, action: "CREATE", module: "asset", entityId: a.id, details: { assetCode: a.assetCode, name: a.name }, createdAt },
          });
          (assets[prefix] ??= []).push({
            id: a.id, code: a.assetCode, prefix, i, name: m.name, createdAt, status, ownerId: holder?.id ?? null,
            locationId, departmentId, serial, cost, purchase,
          });
        }
      }
      const asset = (key: string) => {
        const [p, i] = key.split("-");
        return assets[p][Number(i)];
      };
      console.log(`+ ${Object.values(assets).flat().length} assets`);

      // Final state sets by status → for history of non-personal assets with a non-SPARE status
      const statusEvent = async (a: A, from: AssetStatus, to: AssetStatus, at: Date, ref?: { refType: string; refId: string }) => {
        await tx.assetHistory.create({
          data: { assetId: a.id, event: "STATUS_CHANGED", fromValue: { status: from }, toValue: { status: to }, actorId: admin.id, createdAt: at, ...ref },
        });
      };
      // Shared equipment goes live: SPARE → ACTIVE (placed at its room)
      for (const a of Object.values(assets).flat()) {
        if (a.status === "ACTIVE") {
          await tx.assetHistory.createMany({
            data: [
              { assetId: a.id, event: "MOVED", fromValue: { locationId: null }, toValue: { locationId: a.locationId }, actorId: admin.id, createdAt: new Date(a.createdAt.getTime() + DAY) },
              { assetId: a.id, event: "STATUS_CHANGED", fromValue: { status: "SPARE" }, toValue: { status: "ACTIVE" }, actorId: admin.id, createdAt: new Date(a.createdAt.getTime() + DAY) },
            ],
          });
        }
      }

      // End-of-life equipment
      await statusEvent(asset("NB-7"), "SPARE", "DISPOSED", ago(60));
      await statusEvent(asset("MON-9"), "SPARE", "PENDING_DISPOSAL", ago(20));

      // ----- bundles: PC0-5 each carry a monitor -----
      for (let i = 0; i < 6; i++) {
        const pc = asset(`PC-${i}`);
        const mon = asset(`MON-${i}`);
        await tx.asset.update({ where: { id: mon.id }, data: { ownerId: pc.ownerId, locationId: pc.locationId, departmentId: pc.departmentId, status: "IN_USE" } });
        mon.status = "IN_USE";
        mon.ownerId = pc.ownerId;
        mon.locationId = pc.locationId;
        mon.departmentId = pc.departmentId;
        const attachedAt = new Date(pc.createdAt.getTime() + DAY);
        await tx.assetRelationship.create({ data: { parentId: pc.id, childId: mon.id, type: "COMPONENT", attachedAt } });
        await tx.assetHistory.create({ data: { assetId: mon.id, event: "ATTACHED", toValue: { parentId: pc.id, type: "COMPONENT" }, actorId: admin.id, createdAt: attachedAt } });
      }
      // ----- handover documents -----
      let hnd = await seq(tx, "HND", 17);
      const doc = async (opts: {
        type: "HANDOVER" | "RETURN" | "MOVE";
        at: Date;
        reason: string;
        to: { ownerId: string | null; locationId: string | null; departmentId: string | null };
        items: { a: A; action: "ASSIGN" | "RETURN" | "MOVE"; from: { ownerId: string | null; locationId: string | null; departmentId: string | null; status: AssetStatus }; toStatus: AssetStatus }[];
        signer?: string;
      }) => {
        const docNumber = num("HND", hnd++);
        const t = await tx.assetTransfer.create({
          data: {
            docNumber,
            type: opts.type,
            reason: opts.reason,
            toOwnerId: opts.to.ownerId,
            toLocationId: opts.to.locationId,
            toDepartmentId: opts.to.departmentId,
            performedById: tech.id,
            signedByName: opts.signer ?? null,
            signedAt: opts.signer ? opts.at : null,
            createdAt: opts.at,
          },
        });
        for (const it of opts.items) {
          await tx.assetTransferItem.create({
            data: {
              transferId: t.id,
              assetId: it.a.id,
              action: it.action,
              fromOwnerId: it.from.ownerId,
              toOwnerId: opts.to.ownerId,
              fromLocationId: it.from.locationId,
              toLocationId: opts.to.locationId,
              fromDepartmentId: it.from.departmentId,
              toDepartmentId: opts.to.departmentId,
              fromStatus: it.from.status,
              toStatus: it.toStatus,
            },
          });
          const ref = { refType: "TRANSFER", refId: t.id, actorId: tech.id, createdAt: opts.at };
          const h: Prisma.AssetHistoryCreateManyInput[] = [];
          if (it.from.ownerId !== opts.to.ownerId) h.push({ assetId: it.a.id, event: "ASSIGNED", fromValue: { ownerId: it.from.ownerId }, toValue: { ownerId: opts.to.ownerId }, ...ref });
          if (it.from.locationId !== opts.to.locationId) h.push({ assetId: it.a.id, event: "MOVED", fromValue: { locationId: it.from.locationId }, toValue: { locationId: opts.to.locationId }, ...ref });
          if (it.from.status !== it.toStatus) h.push({ assetId: it.a.id, event: "STATUS_CHANGED", fromValue: { status: it.from.status }, toValue: { status: it.toStatus }, ...ref });
          if (h.length) await tx.assetHistory.createMany({ data: h });
        }
        await tx.systemAuditLog.create({ data: { userId: tech.id, action: "CREATE", module: "deployment", entityId: t.id, details: { docNumber, type: opts.type }, createdAt: opts.at } });
        return t;
      };
      const unplaced = { ownerId: null, locationId: L("คลังพัสดุ"), departmentId: null, status: "SPARE" as AssetStatus };
      const holderName = (id: string | null) => holders.find((h) => h.id === id)?.name ?? "";

      // Personal sets: PC0-5 (+ monitor), PC6, NB0-6, AIO0 → one document each
      let k = 0;
      for (const [key, withMon] of [
        ["PC-0", true], ["PC-1", true], ["PC-2", true], ["PC-3", true], ["PC-4", true], ["PC-5", true], ["PC-6", false],
        ["NB-0", false], ["NB-1", false], ["NB-2", false], ["NB-3", false], ["NB-4", false], ["NB-5", false], ["NB-6", false], ["AIO-0", false],
      ] as const) {
        const a = asset(key);
        const at = new Date(Math.min(a.createdAt.getTime() + 2 * DAY, now.getTime() - 30 * DAY) + k++ * HOUR);
        const set = [a, ...(withMon ? [asset(`MON-${key.split("-")[1]}`)] : [])];
        await doc({
          type: "HANDOVER",
          at,
          reason: "ส่งมอบอุปกรณ์ใช้งานประจำตำแหน่ง",
          to: { ownerId: a.ownerId, locationId: a.locationId, departmentId: a.departmentId },
          items: set.map((x) => ({ a: x, action: "ASSIGN" as const, from: { ...unplaced, locationId: null }, toStatus: "IN_USE" as AssetStatus })),
          signer: holderName(a.ownerId),
        });
      }

      // PC7: handed over earlier, then returned to stock
      {
        const a = asset("PC-7");
        const h = holders[8];
        const first = new Date(a.createdAt.getTime() + 3 * DAY);
        await doc({
          type: "HANDOVER", at: first, reason: "ส่งมอบให้พนักงานใหม่",
          to: { ownerId: h.id, locationId: h.locId, departmentId: h.deptId },
          items: [{ a, action: "ASSIGN", from: { ...unplaced, locationId: null }, toStatus: "IN_USE" }],
          signer: h.name,
        });
        await doc({
          type: "RETURN", at: ago(45), reason: "พนักงานลาออก คืนเครื่องเข้าคลัง",
          to: { ownerId: null, locationId: L("คลังพัสดุ"), departmentId: null },
          items: [{ a, action: "RETURN", from: { ownerId: h.id, locationId: h.locId, departmentId: h.deptId, status: "IN_USE" }, toStatus: "SPARE" }],
        });
      }

      // ----- tickets -----
      const slaHours: Record<TicketPriority, number> = { CRITICAL: 4, HIGH: 8, MEDIUM: 24, LOW: 72 };
      const firstTck = await seq(tx, "TCK", 14);
      let tck = firstTck;
      type TicketPlan = {
        asset?: string;
        category: TicketCategory;
        priority: TicketPriority;
        status: TicketStatus;
        title: string;
        description: string;
        reporter: number | "anon";
        tech: boolean;
        createdHoursAgo: number;
        unusable?: boolean;
        cause?: string;
        resolution?: string;
        labor?: number;
        parts?: { name: string; qty: number; unitCost: number }[];
        resolvedAfterHours?: number;
        closed?: boolean;
        locationText?: string;
        anon?: { name: string; contact: string };
        comments?: { body: string; internal: boolean }[];
      };
      const plans: TicketPlan[] = [
        { asset: "PC-6", category: "IT", priority: "HIGH", status: "OPEN", title: "เปิดเครื่องไม่ติด ไฟไม่เข้า", description: "กดปุ่ม Power แล้วไม่มีสัญญาณใดๆ ตั้งแต่เช้า", reporter: 6, tech: false, createdHoursAgo: 3, unusable: true },
        { asset: "NB-6", category: "IT", priority: "MEDIUM", status: "IN_PROGRESS", title: "โน้ตบุ๊กช้ามากและค้างบ่อย", description: "เปิดโปรแกรมบัญชีแล้วค้าง ต้องรีสตาร์ทหลายครั้งต่อวัน", reporter: 4, tech: true, createdHoursAgo: 20, unusable: true,
          comments: [{ body: "รับเรื่องแล้วครับ เบื้องต้นสงสัย RAM ไม่พอ จะนำเครื่องมาตรวจที่ห้องไอที", internal: false }, { body: "RAM 8GB เหลือ 1 แถว สั่ง RAM 16GB แล้ว รอของ 2 วัน", internal: true }],
          parts: [{ name: "RAM DDR4 16GB", qty: 1, unitCost: 1450 }], labor: 0 },
        { asset: "PRT-4", category: "GENERAL", priority: "LOW", status: "ON_HOLD", title: "เครื่องพิมพ์ดอทเมทริกซ์พิมพ์เป็นเส้น", description: "หัวพิมพ์มีเส้นขาวตัดผ่านทุกบรรทัด", reporter: 7, tech: true, createdHoursAgo: 96, unusable: true,
          comments: [{ body: "รออะไหล่หัวพิมพ์จากผู้จำหน่าย คาดว่าได้รับ 1 สัปดาห์", internal: false }] },
        { asset: "AC-5", category: "FACILITY", priority: "HIGH", status: "IN_PROGRESS", title: "แอร์ห้อง Server ไม่เย็น มีน้ำหยด", description: "อุณหภูมิห้องสูงขึ้นเป็น 30 องศา มีน้ำหยดจากคอยล์เย็น", reporter: 4, tech: true, createdHoursAgo: 6, unusable: true,
          comments: [{ body: "ช่างกำลังตรวจระบบน้ำยา พบรั่วซึมที่ข้อต่อท่อ", internal: false }] },
        { asset: "PC-2", category: "IT", priority: "MEDIUM", status: "RESOLVED", title: "เครื่องไม่เชื่อมต่ออินเทอร์เน็ต", description: "ขึ้นว่า No Internet ทั้งที่เพื่อนร่วมห้องใช้ได้", reporter: 2, tech: true, createdHoursAgo: 30, cause: "สาย LAN ชำรุดที่หัว RJ45", resolution: "เข้าหัวสายใหม่และทดสอบการเชื่อมต่อแล้ว", labor: 150, parts: [{ name: "หัว RJ45 Cat6", qty: 2, unitCost: 15 }], resolvedAfterHours: 3 },
        { asset: "MON-1", category: "IT", priority: "LOW", status: "CLOSED", title: "จอภาพมีเส้นแนวตั้ง", description: "มีเส้นสีเขียวแนวตั้งบริเวณขอบจอด้านขวา", reporter: 1, tech: true, createdHoursAgo: 24 * 12, cause: "สายสัญญาณ HDMI หลวม", resolution: "เปลี่ยนสาย HDMI", labor: 0, parts: [{ name: "สาย HDMI 1.8 ม.", qty: 1, unitCost: 190 }], resolvedAfterHours: 20, closed: true },
        { asset: "NB-2", category: "IT", priority: "HIGH", status: "CLOSED", title: "แบตเตอรี่โน้ตบุ๊กบวม", description: "ฝาท้ายเครื่องนูนขึ้น ไม่ควรชาร์จต่อ", reporter: 6, tech: true, createdHoursAgo: 24 * 20, cause: "แบตเตอรี่เสื่อมตามอายุการใช้งาน", resolution: "เปลี่ยนแบตเตอรี่ใหม่", labor: 300, parts: [{ name: "แบตเตอรี่โน้ตบุ๊ก", qty: 1, unitCost: 1890 }], resolvedAfterHours: 6, closed: true },
        { asset: "NET-0", category: "IT", priority: "CRITICAL", status: "CLOSED", title: "อินเทอร์เน็ตล่มทั้งชั้น 2", description: "ผู้ใช้ชั้น 2 ใช้งานเครือข่ายไม่ได้ทั้งหมด", reporter: 4, tech: true, createdHoursAgo: 24 * 25, cause: "พอร์ต uplink ของสวิตช์ค้าง", resolution: "รีบูตสวิตช์และปรับ config ปิด auto-negotiation", labor: 0, resolvedAfterHours: 2, closed: true,
          comments: [{ body: "ตรวจพบพอร์ต uplink ค้าง รีบูตแล้วกลับมาใช้งานได้", internal: false }] },
        { asset: "UPS-0", category: "IT", priority: "MEDIUM", status: "CLOSED", title: "UPS ร้องเตือนเสียงดังต่อเนื่อง", description: "มีไฟแดงกระพริบและเสียงเตือนทุก 30 วินาที", reporter: 4, tech: true, createdHoursAgo: 24 * 35, cause: "แบตเตอรี่ถึงรอบเปลี่ยน", resolution: "เปลี่ยนแบตเตอรี่ชุดใหม่ ทดสอบ discharge ผ่าน", labor: 500, parts: [{ name: "แบตเตอรี่ UPS 12V 9Ah", qty: 2, unitCost: 980 }], resolvedAfterHours: 30, closed: true },
        { asset: "AC-1", category: "FACILITY", priority: "MEDIUM", status: "CLOSED", title: "แอร์ห้องไอทีมีกลิ่นอับ", description: "เปิดแอร์แล้วมีกลิ่นอับและความเย็นลดลง", reporter: 4, tech: true, createdHoursAgo: 24 * 48, cause: "คอยล์เย็นสกปรก", resolution: "ล้างแอร์ใหญ่และเติมน้ำยา", labor: 1200, parts: [{ name: "น้ำยาล้างแอร์", qty: 1, unitCost: 350 }], resolvedAfterHours: 8, closed: true },
        { category: "FACILITY", priority: "LOW", status: "OPEN", title: "หลอดไฟห้องประชุม 1 ขาด 2 ดวง", description: "แสงสว่างไม่พอสำหรับการประชุม", reporter: 5, tech: false, createdHoursAgo: 24 * 5, locationText: "ห้องประชุม 1 ชั้น 2 อาคาร A" },
        { asset: "PC-4", category: "IT", priority: "MEDIUM", status: "CANCELLED", title: "ขอติดตั้งโปรแกรม Photoshop", description: "ต้องการใช้ออกแบบสื่อประชาสัมพันธ์", reporter: 4, tech: true, createdHoursAgo: 24 * 15, resolution: "ยกเลิก: ไม่ใช่งานซ่อม ให้ยื่นคำขอผ่านฝ่ายไอที", comments: [{ body: "ขอยกเลิกครับ ไม่ใช่งานซ่อม ให้ส่งคำขอโปรแกรมผ่านฝ่ายไอที", internal: false }] },
        { asset: "PRT-1", category: "GENERAL", priority: "MEDIUM", status: "OPEN", title: "เครื่องพิมพ์กระดาษติดบ่อย", description: "พิมพ์ได้ 3–4 แผ่นก็กระดาษติด (แจ้งผ่าน QR หน้าเครื่อง)", reporter: "anon", tech: false, createdHoursAgo: 28, anon: { name: "คุณสุดา (ฝ่ายบัญชี)", contact: "089-000-0000" } },
        { asset: "NB-3", category: "IT", priority: "LOW", status: "RESOLVED", title: "ขอเปลี่ยนเมาส์ไร้สายที่เสีย", description: "เมาส์คลิกซ้ายไม่ติดเป็นบางครั้ง", reporter: 7, tech: true, createdHoursAgo: 24 * 4, cause: "ไมโครสวิตช์เสื่อม", resolution: "เปลี่ยนเมาส์ใหม่", labor: 0, parts: [{ name: "เมาส์ไร้สาย", qty: 1, unitCost: 390 }], resolvedAfterHours: 5 },
      ];
      const tickets: { id: string; number: string; assetKey?: string; status: TicketStatus; createdAt: Date; title: string }[] = [];
      for (const p of plans) {
        const createdAt = ago(0, p.createdHoursAgo);
        const number = num("TCK", tck++);
        const a = p.asset ? asset(p.asset) : undefined;
        const reporterId = p.reporter === "anon" ? null : holders[p.reporter].id;
        const dueAt = new Date(createdAt.getTime() + slaHours[p.priority] * HOUR);
        const partsCost = (p.parts ?? []).reduce((s, x) => s + x.qty * x.unitCost, 0);
        const resolvedAt = p.resolvedAfterHours ? new Date(createdAt.getTime() + p.resolvedAfterHours * HOUR) : null;
        const closedAt = p.closed && resolvedAt ? new Date(resolvedAt.getTime() + 2 * HOUR) : p.status === "CANCELLED" ? new Date(createdAt.getTime() + 2 * HOUR) : null;
        const firstResponseAt = p.tech || p.status === "CLOSED" ? new Date(createdAt.getTime() + 25 * 60_000) : null;
        const before: AssetStatus = p.asset === "AC-5" || p.asset === "PRT-4" ? "ACTIVE" : "IN_USE";
        const previousAssetStatus: AssetStatus | null = p.unusable && a ? before : null;
        const t = await tx.ticket.create({
          data: {
            ticketNumber: number,
            category: p.category,
            source: p.reporter === "anon" ? "QR_PUBLIC" : p.asset && p.createdHoursAgo % 2 === 0 ? "QR" : "WEB",
            assetId: a?.id ?? null,
            assetUnusable: !!p.unusable,
            previousAssetStatus,
            reporterId,
            reporterName: p.anon?.name ?? null,
            reporterContact: p.anon?.contact ?? null,
            assignedTechId: p.tech ? tech.id : null,
            title: p.title,
            description: p.description,
            locationText: p.locationText ?? null,
            priority: p.priority,
            status: p.status,
            cause: p.cause ?? null,
            resolution: p.resolution ?? null,
            laborCost: new Prisma.Decimal(p.labor ?? 0),
            repairCost: new Prisma.Decimal(partsCost + (p.labor ?? 0)),
            dueAt,
            firstResponseAt,
            resolvedAt,
            closedAt,
            createdAt,
          },
        });
        const at = (mins: number) => new Date(createdAt.getTime() + mins * 60_000);
        const acts: Prisma.TicketActivityCreateManyInput[] = [
          { ticketId: t.id, kind: "CREATED", body: p.anon ? `แจ้งโดย ${p.anon.name} (${p.anon.contact})` : null, actorId: reporterId, createdAt },
        ];
        if (p.tech) acts.push({ ticketId: t.id, kind: "ASSIGNED", fromValue: { userId: null }, toValue: { userId: tech.id }, actorId: manager.id, createdAt: at(10) });
        if (["IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"].includes(p.status) || p.status === "CANCELLED") {
          acts.push({ ticketId: t.id, kind: "STATUS_CHANGED", fromValue: { status: "OPEN" }, toValue: { status: "IN_PROGRESS" }, actorId: tech.id, createdAt: at(30) });
        }
        let m = 40;
        for (const c of p.comments ?? []) acts.push({ ticketId: t.id, kind: "COMMENT", body: c.body, internal: c.internal, actorId: tech.id, createdAt: at((m += 20)) });
        for (const part of p.parts ?? []) {
          acts.push({ ticketId: t.id, kind: "PART_ADDED", internal: true, body: `${part.name} × ${part.qty}`, actorId: tech.id, createdAt: at((m += 5)) });
        }
        if (p.status === "ON_HOLD") acts.push({ ticketId: t.id, kind: "STATUS_CHANGED", body: "รออะไหล่", fromValue: { status: "IN_PROGRESS" }, toValue: { status: "ON_HOLD" }, actorId: tech.id, createdAt: at(120) });
        if (resolvedAt) acts.push({ ticketId: t.id, kind: "STATUS_CHANGED", body: p.resolution ?? null, fromValue: { status: "IN_PROGRESS" }, toValue: { status: "RESOLVED" }, actorId: tech.id, createdAt: resolvedAt });
        if (p.closed && closedAt) acts.push({ ticketId: t.id, kind: "STATUS_CHANGED", fromValue: { status: "RESOLVED" }, toValue: { status: "CLOSED" }, actorId: manager.id, createdAt: closedAt });
        if (p.status === "CANCELLED" && closedAt) acts.push({ ticketId: t.id, kind: "STATUS_CHANGED", body: p.resolution ?? null, fromValue: { status: "IN_PROGRESS" }, toValue: { status: "CANCELLED" }, actorId: tech.id, createdAt: closedAt });
        await tx.ticketActivity.createMany({ data: acts });
        for (const part of p.parts ?? []) {
          await tx.ticketPart.create({ data: { ticketId: t.id, name: part.name, qty: part.qty, unitCost: new Prisma.Decimal(part.unitCost), createdAt: at(m) } });
        }
        if (a && p.unusable) await statusEvent(a, before, "IN_MAINTENANCE", createdAt, { refType: "TICKET", refId: t.id });
        await tx.systemAuditLog.create({ data: { userId: reporterId, action: p.reporter === "anon" ? "PUBLIC_REPORT" : "CREATE", module: "ticket", entityId: t.id, details: { ticketNumber: number, title: p.title }, createdAt } });
        tickets.push({ id: t.id, number, assetKey: p.asset, status: p.status, createdAt, title: p.title });
      }
      console.log(`+ ${tickets.length} tickets`);

      // ----- vendor claims -----
      const firstClm = await seq(tx, "CLM", 4);
      type ClaimPlan = {
        asset: string;
        vendor: string;
        status: "SENT" | "IN_REPAIR" | "RETURNED" | "REPLACED";
        problem: string;
        sentDaysAgo: number;
        expectedInDays: number;
        previous: AssetStatus;
        cost?: number;
        returnedDaysAgo?: number;
        newSerial?: string;
        ticket?: number;
        notes?: string;
      };
      const claimPlans: ClaimPlan[] = [
        { asset: "MON-6", vendor: "ไอที ซัพพลาย", status: "SENT", problem: "แผงจอมีจุดดำ ยังอยู่ในระยะประกัน", sentDaysAgo: 2, expectedInDays: 12, previous: "SPARE" },
        { asset: "PRT-5", vendor: "เซอร์วิส", status: "IN_REPAIR", problem: "หัวพิมพ์ฉลากไม่ร้อน พิมพ์ไม่ติด", sentDaysAgo: 24, expectedInDays: -6, previous: "ACTIVE", notes: "ผู้จำหน่ายแจ้งรอตรวจสอบหัวพิมพ์ใหม่" },
        { asset: "UPS-2", vendor: "ไอที ซัพพลาย", status: "RETURNED", problem: "UPS ไม่สำรองไฟ แบตเตอรี่เสื่อม", sentDaysAgo: 40, expectedInDays: -25, previous: "ACTIVE", cost: 1850, returnedDaysAgo: 27 },
        { asset: "NET-2", vendor: "เน็ตเวิร์ค", status: "REPLACED", problem: "Access Point ดับเอง เปิดไม่ติด", sentDaysAgo: 70, expectedInDays: -50, previous: "ACTIVE", cost: 0, returnedDaysAgo: 52, newSerial: "SNNETR-2026-0412", notes: "ผู้ผลิตเปลี่ยนเครื่องใหม่ให้ตามเงื่อนไขประกัน" },
      ];
      let clm = firstClm;
      for (const c of claimPlans) {
        const a = asset(c.asset);
        const sent = ago(c.sentDaysAgo);
        const claimNumber = num("CLM", clm++);
        const vendor = vendorBy(c.vendor);
        const ended = c.status === "RETURNED" || c.status === "REPLACED";
        const row = await tx.externalClaim.create({
          data: {
            claimNumber,
            assetId: a.id,
            vendorId: vendor.id,
            problem: c.problem,
            sentDate: dateOnly(sent),
            expectedReturnDate: dateOnly(ahead(c.expectedInDays)),
            actualReturnDate: ended ? dateOnly(ago(c.returnedDaysAgo ?? 0)) : null,
            status: c.status,
            previousAssetStatus: c.previous,
            cost: c.cost === undefined ? null : new Prisma.Decimal(c.cost),
            oldSerial: c.status === "REPLACED" ? a.serial : null,
            newSerial: c.newSerial ?? null,
            notes: c.notes ?? null,
            createdById: tech.id,
            createdAt: sent,
          },
        });
        await statusEvent(a, c.previous, "CLAIMING", sent, { refType: "CLAIM", refId: row.id });
        if (ended) {
          await statusEvent(a, "CLAIMING", c.previous, ago(c.returnedDaysAgo ?? 0), { refType: "CLAIM", refId: row.id });
          if (c.status === "REPLACED" && c.newSerial) {
            await tx.asset.update({ where: { id: a.id }, data: { serialNumber: c.newSerial } });
            await tx.assetHistory.create({
              data: { assetId: a.id, event: "UPDATED", toValue: { serialNumber: { from: a.serial, to: c.newSerial } }, refType: "CLAIM", refId: row.id, actorId: tech.id, createdAt: ago(c.returnedDaysAgo ?? 0) },
            });
          }
        }
        await tx.systemAuditLog.create({ data: { userId: tech.id, action: "CREATE", module: "claim", entityId: row.id, details: { claimNumber, assetCode: a.code }, createdAt: sent } });
      }
      console.log(`+ ${claimPlans.length} claims`);

      // ----- preventive maintenance -----
      const checklist = {
        ac: [
          { id: "c1", label: "ล้างแผ่นกรองอากาศ", type: "CHECK", required: true },
          { id: "c2", label: "ตรวจน้ำยาแอร์/ความเย็น", type: "CHECK", required: true },
          { id: "c3", label: "อุณหภูมิลมเย็น", type: "NUMBER", unit: "°C", required: true },
          { id: "c4", label: "หมายเหตุอื่นๆ", type: "TEXT", required: false },
        ],
        ups: [
          { id: "u1", label: "ตรวจสอบสถานะไฟแสดงผล", type: "CHECK", required: true },
          { id: "u2", label: "แรงดันแบตเตอรี่", type: "NUMBER", unit: "V", required: true },
          { id: "u3", label: "ทดสอบ discharge", type: "CHECK", required: true },
        ],
        room: [
          { id: "r1", label: "ทำความสะอาดฝุ่นตู้ Rack", type: "CHECK", required: true },
          { id: "r2", label: "อุณหภูมิห้อง", type: "NUMBER", unit: "°C", required: true },
          { id: "r3", label: "ตรวจสายสัญญาณ/ป้ายกำกับ", type: "CHECK", required: true },
        ],
        net: [
          { id: "n1", label: "สำรอง config อุปกรณ์", type: "CHECK", required: true },
          { id: "n2", label: "อัปเดต firmware", type: "CHECK", required: true },
          { id: "n3", label: "ตรวจ LED/พอร์ตผิดปกติ", type: "CHECK", required: true },
        ],
      };
      type Item = { id: string; label: string; type: string; unit?: string };
      const result = (items: Item[], failId?: string) =>
        items.map((it) => {
          const value = it.type === "CHECK" ? (it.id === failId ? "fail" : "pass") : it.type === "NUMBER" ? (it.unit === "V" ? "12.6" : it.id === "c3" ? "14" : "24") : "ปกติ";
          return { itemId: it.id, label: it.label, type: it.type, unit: it.unit, value, pass: it.type === "CHECK" ? value === "pass" : null };
        });
      const step = (f: PmFrequency, d: Date) => (f === "WEEKLY" ? new Date(d.getTime() + 7 * DAY) : addMonths(d, f === "MONTHLY" ? 1 : f === "QUARTERLY" ? 3 : 12));
      type PmPlan = {
        title: string;
        description: string;
        asset?: string;
        location?: string;
        frequency: PmFrequency;
        first: Date;
        items: Item[];
        runs: { status: PmRunStatus; failId?: string; notes?: string }[];
      };
      const pmPlans: PmPlan[] = [
        { title: "ล้างและตรวจเช็คแอร์ห้องประชุม 1 ประจำไตรมาส", description: "ล้างแผ่นกรอง ตรวจน้ำยา และวัดอุณหภูมิ", asset: "AC-0", frequency: "QUARTERLY", first: dateOnly(ago(190)), items: checklist.ac,
          runs: [{ status: "DONE" }, { status: "DONE", failId: "c2", notes: "น้ำยาเริ่มพร่อง แนะนำเติมในรอบถัดไป" }, { status: "SCHEDULED" }] },
        { title: "ตรวจเช็ค UPS ห้อง Server ประจำเดือน", description: "ตรวจสถานะและทดสอบ discharge", asset: "UPS-0", frequency: "MONTHLY", first: dateOnly(ago(70)), items: checklist.ups,
          runs: [{ status: "DONE" }, { status: "OVERDUE" }, { status: "SCHEDULED" }] },
        { title: "ทำความสะอาดและตรวจห้อง Server", description: "ทำความสะอาดตู้ Rack และตรวจสายสัญญาณ", location: "ห้อง Server", frequency: "MONTHLY", first: dateOnly(ago(58)), items: checklist.room,
          runs: [{ status: "DONE" }, { status: "DONE" }, { status: "SCHEDULED" }] },
        { title: "สำรอง config และอัปเดต firmware Switch หลัก", description: "ประจำปี ตามแผนความมั่นคงปลอดภัย", asset: "NET-0", frequency: "YEARLY", first: dateOnly(ahead(40)), items: checklist.net, runs: [] },
      ];
      for (const p of pmPlans) {
        const dues: Date[] = [];
        let cur = p.first;
        for (let r = 0; r < p.runs.length; r++) {
          dues.push(cur);
          cur = step(p.frequency, cur);
        }
        const s = await tx.pmSchedule.create({
          data: {
            title: p.title,
            description: p.description,
            assetId: p.asset ? asset(p.asset).id : null,
            locationId: p.location ? L(p.location) : null,
            frequency: p.frequency,
            startDate: p.first,
            nextDueDate: cur, // next run still to be generated
            assignedTechId: tech.id,
            checklistTemplate: p.items.map((x) => ({ ...x, required: true })) as unknown as Prisma.InputJsonValue,
            createdAt: ago(200),
          },
        });
        for (let r = 0; r < p.runs.length; r++) {
          const run = p.runs[r];
          const done = run.status === "DONE";
          await tx.pmRun.create({
            data: {
              scheduleId: s.id,
              dueDate: dues[r],
              status: run.status,
              checklistResult: done ? (result(p.items, run.failId) as unknown as Prisma.InputJsonValue) : undefined,
              notes: run.notes ?? null,
              startedAt: done ? new Date(dues[r].getTime() + 9 * HOUR) : null,
              doneById: done ? tech.id : null,
              doneAt: done ? new Date(dues[r].getTime() + 11 * HOUR) : null,
              createdAt: new Date(dues[r].getTime() - 14 * DAY),
            },
          });
        }
        await tx.systemAuditLog.create({ data: { userId: manager.id, action: "CREATE", module: "pm", entityId: s.id, details: { title: p.title }, createdAt: ago(200) } });
      }
      console.log(`+ ${pmPlans.length} PM plans`);

      // ----- stock takes -----
      const inBuilding = (loc: string | null, root: string) => {
        // locations of the demo tree: walk up via the path map
        for (const n of locationTree) {
          if (!n.path.join("/").startsWith(root)) continue;
          if (pathId.get(n.path.join("/")) === loc) return true;
        }
        return false;
      };
      const rootNameA = "อาคาร A (สำนักงานใหญ่)";
      const all = Object.values(assets).flat().filter((a) => a.status !== "DISPOSED");
      const inA = all.filter((a) => inBuilding(a.locationId, rootNameA));
      const inB = all.filter((a) => inBuilding(a.locationId, "อาคาร B"));

      // 1) closed campaign last year-end, warehouse only
      const closed = await tx.auditCampaign.create({
        data: {
          title: "ตรวจนับครุภัณฑ์คลังพัสดุ อาคาร B ประจำปี", year: year - 1, startDate: dateOnly(ago(330)), endDate: dateOnly(ago(320)),
          scopeLocationIds: [buildingB], status: "CLOSED", note: "ตรวจนับสิ้นปีงบประมาณ", createdById: manager.id,
          completedAt: ago(318), closedAt: ago(315), createdAt: ago(335), auditors: { create: [{ userId: auditor.id }] },
        },
      });
      for (const a of inB) {
        await tx.auditRecord.create({
          data: { campaignId: closed.id, assetId: a.id, scannedCode: a.code, scannedById: auditor.id, expectedLocationId: a.locationId, actualLocationId: a.locationId, condition: a.status === "PENDING_DISPOSAL" ? "DAMAGED" : "GOOD", result: "MATCHED", scannedAt: ago(325), createdAt: ago(325) },
        });
      }

      // 2) running campaign in building A: most scanned, a few relocated, one unknown code, the rest still to scan
      const running = await tx.auditCampaign.create({
        data: {
          title: "ตรวจนับครุภัณฑ์ อาคาร A ไตรมาส 4", year, startDate: dateOnly(ago(3)), endDate: dateOnly(ahead(10)),
          scopeLocationIds: [buildingA], status: "IN_PROGRESS", note: "ตรวจนับประจำไตรมาส ใช้เครื่องสแกนมือถือ", createdById: manager.id,
          createdAt: ago(5), auditors: { create: [{ userId: auditor.id }] },
        },
      });
      const scanned = inA.filter((_, idx) => idx % 5 !== 4); // ~80%
      let relocatedLeft = 3;
      for (const a of scanned) {
        const relocate = relocatedLeft > 0 && a.prefix === "PRT" ? (relocatedLeft--, true) : false;
        const actual = relocate ? L("ห้องประชุม 1") : a.locationId;
        const when = ago(2, scanned.indexOf(a) % 20);
        await tx.auditScan.create({
          data: { campaignId: running.id, clientUuid: randomUUID(), scannedCode: a.code, actualLocationId: actual, condition: "GOOD", scannedById: auditor.id, scannedAt: when, receivedAt: when },
        });
        await tx.auditRecord.create({
          data: { campaignId: running.id, assetId: a.id, scannedCode: a.code, scannedById: auditor.id, expectedLocationId: a.locationId, actualLocationId: actual, condition: "GOOD", result: relocate ? "RELOCATED" : "MATCHED", notes: relocate ? "พบในห้องประชุม 1" : null, scannedAt: when },
        });
      }
      {
        const when = ago(2, 1);
        await tx.auditScan.create({ data: { campaignId: running.id, clientUuid: randomUUID(), scannedCode: "XX-9999", actualLocationId: L("ห้อง 101 ฝ่ายบุคคล"), condition: "GOOD", notes: "พบอุปกรณ์ไม่มีป้ายรหัส", scannedById: auditor.id, scannedAt: when, receivedAt: when } });
        await tx.auditRecord.create({ data: { campaignId: running.id, scannedCode: "XX-9999", scannedById: auditor.id, actualLocationId: L("ห้อง 101 ฝ่ายบุคคล"), condition: "GOOD", result: "UNREGISTERED", notes: "พบอุปกรณ์ไม่มีป้ายรหัส", scannedAt: when } });
      }

      // 3) draft campaign
      await tx.auditCampaign.create({
        data: { title: "ตรวจนับครุภัณฑ์ อาคาร B (ร่าง)", year, startDate: dateOnly(ahead(14)), endDate: dateOnly(ahead(24)), scopeLocationIds: [buildingB], status: "DRAFT", createdById: manager.id, auditors: { create: [{ userId: auditor.id }] } },
      });
      await tx.systemAuditLog.createMany({
        data: [
          { userId: manager.id, action: "CREATE", module: "audit", entityId: closed.id, details: { title: closed.title }, createdAt: ago(335) },
          { userId: manager.id, action: "CREATE", module: "audit", entityId: running.id, details: { title: running.title }, createdAt: ago(5) },
        ],
      });
      console.log("+ 3 stock-take campaigns");

      // ----- notifications -----
      const t = (n: number) => tickets[n];
      const notes = [
        { userId: tech.id, event: "TICKET_ASSIGNED", title: `มอบหมายงาน ${t(1).number}`, body: t(1).title, href: `/tickets/${t(1).id}`, createdAt: ago(0, 19), readAt: ago(0, 18) },
        { userId: tech.id, event: "TICKET_ASSIGNED", title: `มอบหมายงาน ${t(3).number}`, body: t(3).title, href: `/tickets/${t(3).id}`, createdAt: ago(0, 6), readAt: null },
        { userId: tech.id, event: "PM_OVERDUE", title: "งาน PM เลยกำหนด", body: "ตรวจเช็ค UPS ห้อง Server ประจำเดือน", href: "/pm", createdAt: ago(0, 2), readAt: null },
        { userId: manager.id, event: "TICKET_CREATED", title: `แจ้งซ่อมใหม่ ${t(0).number}`, body: t(0).title, href: `/tickets/${t(0).id}`, createdAt: ago(0, 3), readAt: null },
        { userId: manager.id, event: "CLAIM_OVERDUE", title: "เคลมเลยกำหนดรับคืน", body: `${num("CLM", firstClm + 1)} เครื่องพิมพ์ฉลาก Zebra`, href: "/claims", createdAt: ago(1), readAt: null },
        { userId: admin.id, event: "TICKET_CREATED", title: `แจ้งซ่อมใหม่ ${t(12).number}`, body: t(12).title, href: `/tickets/${t(12).id}`, createdAt: ago(0, 28), readAt: ago(0, 20) },
        { userId: admin.id, event: "WARRANTY_EXPIRING", title: "ประกันใกล้หมดอายุ", body: "มีครุภัณฑ์ 4 รายการที่ประกันจะหมดภายใน 30 วัน", href: "/assets", createdAt: ago(1, 4), readAt: null },
        { userId: admin.id, event: "TICKET_SLA_OVERDUE", title: `เกินกำหนด SLA ${t(10).number}`, body: t(10).title, href: `/tickets/${t(10).id}`, createdAt: ago(1), readAt: null },
        { userId: holders[2].id, event: "TICKET_STATUS", title: `${t(4).number} แก้ไขเรียบร้อยแล้ว`, body: t(4).title, href: `/tickets/${t(4).id}`, createdAt: ago(0, 27), readAt: null },
      ];
      await tx.notification.createMany({ data: notes });

      await tx.systemSetting.create({ data: { key: MARKER, value: { createdAt: now.toISOString(), assets: 50 } } });
    },
    { timeout: 180_000, maxWait: 30_000 },
  );
  console.log("Done. Demo dataset created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
