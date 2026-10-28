import "server-only";
import { z } from "zod";
import { assetConditionLabels, assetStatusLabels, initialAssetStatuses } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { listLocations } from "@/modules/master/queries";
import { MAX_IMPORT_ROWS, PROP_COLUMN_PREFIX } from "./import-columns";
import { validateProperties } from "./properties";
import { assetFieldsSchema, type AssetFields } from "./schemas";

export const importPayloadSchema = z.object({
  categoryId: z.string().min(1),
  rows: z
    .array(z.record(z.string(), z.string().max(2000)))
    .min(1, "ไม่มีข้อมูลในไฟล์")
    .max(MAX_IMPORT_ROWS, `นำเข้าได้ไม่เกิน ${MAX_IMPORT_ROWS} แถวต่อครั้ง`),
});
export type ImportPayload = z.infer<typeof importPayloadSchema>;

export type PreparedRow = {
  row: number; // 1-based data row number (excluding header)
  fields: AssetFields;
  status: (typeof initialAssetStatuses)[number];
  properties: Record<string, string>;
};
export type RowError = { row: number; messages: string[] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function reverseLookup<T extends string>(labels: Record<T, string>, allowed?: readonly T[]) {
  const map = new Map<string, T>();
  for (const [k, label] of Object.entries(labels) as [T, string][]) {
    if (allowed && !allowed.includes(k)) continue;
    map.set(norm(k), k);
    map.set(norm(label), k);
  }
  return map;
}

/** Validate import rows and resolve names (username, department, location path) to ids. */
export async function prepareImport({ categoryId, rows }: ImportPayload) {
  const category = await prisma.assetCategory.findUnique({ where: { id: categoryId }, include: { propertyDefs: true } });
  if (!category) return { category: null, prepared: [], errors: [{ row: 0, messages: ["ไม่พบประเภทครุภัณฑ์"] }] };

  const [users, departments, locations, existingBarcodes] = await Promise.all([
    prisma.user.findMany({ where: { banned: false, username: { not: null } }, select: { id: true, username: true } }),
    prisma.department.findMany({ select: { id: true, name: true } }),
    listLocations(),
    prisma.asset.findMany({
      where: { barcode: { in: rows.map((r) => r.barcode?.trim()).filter((b): b is string => !!b) } },
      select: { barcode: true },
    }),
  ]);
  const userByName = new Map(users.map((u) => [norm(u.username ?? ""), u.id]));
  const deptByName = new Map(departments.map((d) => [norm(d.name), d.id]));
  const locByPath = new Map(locations.map((l) => [norm(l.path), l.id]));
  const statusMap = reverseLookup(assetStatusLabels, initialAssetStatuses);
  const conditionMap = reverseLookup(assetConditionLabels);
  const takenBarcodes = new Set(existingBarcodes.map((b) => b.barcode));
  const seenBarcodes = new Set<string>();

  const prepared: PreparedRow[] = [];
  const errors: RowError[] = [];

  rows.forEach((raw, i) => {
    const row = i + 1;
    const messages: string[] = [];
    const get = (k: string) => raw[k]?.trim() || undefined;

    const status = get("status") ? statusMap.get(norm(get("status")!)) : "SPARE";
    if (!status) messages.push(`สถานะ "${get("status")}" ไม่ถูกต้อง (ใช้: ${initialAssetStatuses.map((s) => assetStatusLabels[s]).join(", ")})`);
    const condition = get("condition") ? conditionMap.get(norm(get("condition")!)) : "GOOD";
    if (!condition) messages.push(`สภาพ "${get("condition")}" ไม่ถูกต้อง`);

    const ownerId = get("owner") ? userByName.get(norm(get("owner")!)) : undefined;
    if (get("owner") && !ownerId) messages.push(`ไม่พบผู้ใช้ "${get("owner")}"`);
    const departmentId = get("department") ? deptByName.get(norm(get("department")!)) : undefined;
    if (get("department") && !departmentId) messages.push(`ไม่พบแผนก "${get("department")}"`);
    const locationId = get("location") ? locByPath.get(norm(get("location")!)) : undefined;
    if (get("location") && !locationId) messages.push(`ไม่พบสถานที่ "${get("location")}"`);

    const barcode = get("barcode");
    if (barcode) {
      if (takenBarcodes.has(barcode)) messages.push(`บาร์โค้ด "${barcode}" มีในระบบแล้ว`);
      else if (seenBarcodes.has(barcode)) messages.push(`บาร์โค้ด "${barcode}" ซ้ำในไฟล์`);
      seenBarcodes.add(barcode);
    }

    const parsed = assetFieldsSchema.safeParse({
      name: get("name"),
      brand: get("brand"),
      model: get("model"),
      serialNumber: get("serialNumber"),
      barcode,
      purchaseDate: get("purchaseDate"),
      warrantyExpiry: get("warrantyExpiry"),
      cost: get("cost")?.replace(/,/g, ""),
      condition: condition ?? "GOOD",
      ownerId,
      departmentId,
      locationId,
      note: get("note"),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) messages.push(`${String(issue.path[0] ?? "")}: ${issue.message}`);
    }

    const propsRaw = Object.fromEntries(
      Object.entries(raw)
        .filter(([k]) => k.startsWith(PROP_COLUMN_PREFIX))
        .map(([k, v]) => [k.slice(PROP_COLUMN_PREFIX.length), v]),
    );
    const props = validateProperties(category.propertyDefs, propsRaw);
    messages.push(...Object.values(props.errors));

    if (messages.length || !parsed.success || !status) errors.push({ row, messages });
    else prepared.push({ row, fields: parsed.data, status, properties: props.values });
  });

  return { category, prepared, errors };
}
