"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { nextAssetCodes } from "@/lib/sequence";
import { requirePermission } from "@/lib/session";
import { importPayloadSchema, prepareImport, type ImportPayload, type RowError } from "./import";
import { validateProperties } from "./properties";
import {
  bulkCreateSchema,
  createAssetSchema,
  PROP_PREFIX,
  updateAssetSchema,
  type AssetFields,
  type BulkCreateInput,
  type CreateAssetInput,
  type UpdateAssetInput,
} from "./schemas";

type Errors = Record<string, string[]>;

function splitForm(formData: FormData) {
  const all = formDataToObject(formData);
  const fields: Record<string, string | undefined> = {};
  const props: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(PROP_PREFIX)) props[k.slice(PROP_PREFIX.length)] = v;
    else fields[k] = v;
  }
  return { fields, props };
}

const toDate = (v?: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

/** Asset columns from validated fields (shared by create/edit/bulk/import) */
function assetData(f: AssetFields) {
  return {
    name: f.name,
    brand: f.brand ?? null,
    model: f.model ?? null,
    serialNumber: f.serialNumber ?? null,
    barcode: f.barcode ?? null,
    purchaseDate: toDate(f.purchaseDate),
    warrantyExpiry: toDate(f.warrantyExpiry),
    cost: f.cost ? new Prisma.Decimal(f.cost) : null,
    condition: f.condition,
    ownerId: f.ownerId ?? null,
    departmentId: f.departmentId ?? null,
    locationId: f.locationId ?? null,
    note: f.note ?? null,
  };
}

/** Ensure referenced owner/department/location exist and are active. */
async function checkReferences(f: Pick<AssetFields, "ownerId" | "departmentId" | "locationId">): Promise<Errors> {
  const errors: Errors = {};
  const [owner, department, location] = await Promise.all([
    f.ownerId ? prisma.user.findFirst({ where: { id: f.ownerId, banned: false }, select: { id: true } }) : null,
    f.departmentId ? prisma.department.findUnique({ where: { id: f.departmentId }, select: { id: true } }) : null,
    f.locationId ? prisma.location.findFirst({ where: { id: f.locationId, deletedAt: null }, select: { id: true } }) : null,
  ]);
  if (f.ownerId && !owner) errors.ownerId = ["ไม่พบผู้ใช้"];
  if (f.departmentId && !department) errors.departmentId = ["ไม่พบแผนก"];
  if (f.locationId && !location) errors.locationId = ["ไม่พบสถานที่"];
  return errors;
}

function propErrors(errors: Record<string, string>): Errors {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${PROP_PREFIX}${k}`, [v]]));
}

async function actor(action: "create" | "update" | "delete") {
  const session = await requirePermission("asset", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

// ---------- Create ----------

export async function createAsset(_prev: FormState<CreateAssetInput>, formData: FormData): Promise<FormState<CreateAssetInput>> {
  const who = await actor("create");
  const { fields, props } = splitForm(formData);
  const parsed = createAssetSchema.safeParse(fields);
  if (!parsed.success) return fieldErrors(parsed.error);
  const f = parsed.data;

  const category = await prisma.assetCategory.findUnique({ where: { id: f.categoryId }, include: { propertyDefs: true } });
  if (!category) return { fieldErrors: { categoryId: ["ไม่พบประเภท"] } };
  const { values, errors } = validateProperties(category.propertyDefs, props);
  const refErrors = await checkReferences(f);
  if (Object.keys(errors).length || Object.keys(refErrors).length) {
    return { fieldErrors: { ...refErrors, ...propErrors(errors) } as FormState<CreateAssetInput>["fieldErrors"], message: "กรุณาตรวจสอบข้อมูลที่กรอก" };
  }

  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      const [assetCode] = await nextAssetCodes(tx, category.codePrefix);
      const asset = await tx.asset.create({
        data: {
          ...assetData(f),
          assetCode,
          categoryId: category.id,
          status: f.status,
          properties: { create: Object.entries(values).map(([key, value]) => ({ key, value })) },
        },
      });
      await tx.assetHistory.create({
        data: { assetId: asset.id, event: "CREATED", toValue: { assetCode, status: f.status }, actorId: who.userId },
      });
      await logAction({ ...who, action: "CREATE", module: "asset", entityId: asset.id, details: { assetCode, name: f.name } }, tx);
      return asset.id;
    });
  } catch (e) {
    if (isUniqueViolation(e, "barcode")) return { fieldErrors: { barcode: ["บาร์โค้ดนี้ถูกใช้แล้ว"] } };
    throw e;
  }

  revalidatePath("/assets");
  redirect(`/assets/${id}?created=1`);
}

// ---------- Update ----------

const tracked = ["name", "brand", "model", "serialNumber", "barcode", "purchaseDate", "warrantyExpiry", "cost", "note", "departmentId"] as const;

export async function updateAsset(_prev: FormState<UpdateAssetInput>, formData: FormData): Promise<FormState<UpdateAssetInput>> {
  const who = await actor("update");
  const { fields, props } = splitForm(formData);
  const parsed = updateAssetSchema.safeParse(fields);
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, ...f } = parsed.data;

  const current = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
    include: { category: { include: { propertyDefs: true } }, properties: true },
  });
  if (!current) return { message: "ไม่พบครุภัณฑ์ หรือถูกลบไปแล้ว" };

  const { values, errors } = validateProperties(current.category.propertyDefs, props);
  const refErrors = await checkReferences(f);
  if (Object.keys(errors).length || Object.keys(refErrors).length) {
    return { fieldErrors: { ...refErrors, ...propErrors(errors) } as FormState<UpdateAssetInput>["fieldErrors"], message: "กรุณาตรวจสอบข้อมูลที่กรอก" };
  }

  // Holder, location and department change only through deployment documents (handover/move/swap)
  const next = { ...assetData(f), ownerId: current.ownerId, locationId: current.locationId, departmentId: current.departmentId };
  const show = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v));

  // Field-level diff for history
  const changes: Record<string, { from: string | null; to: string | null }> = {};
  for (const key of tracked) {
    const from = show(current[key]);
    const to = show(next[key]);
    if (from !== to) changes[key] = { from, to };
  }
  const oldProps = Object.fromEntries(current.properties.map((p) => [p.key, p.value]));
  const defKeys = current.category.propertyDefs.map((d) => d.key);
  for (const key of defKeys) {
    if ((oldProps[key] ?? null) !== (values[key] ?? null)) changes[`prop.${key}`] = { from: oldProps[key] ?? null, to: values[key] ?? null };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id }, data: next });

      // Replace values for currently defined keys; values of removed definitions are kept
      await tx.assetProperty.deleteMany({ where: { assetId: id, key: { in: defKeys } } });
      if (Object.keys(values).length) {
        await tx.assetProperty.createMany({ data: Object.entries(values).map(([key, value]) => ({ assetId: id, key, value })) });
      }

      const history: Prisma.AssetHistoryCreateManyInput[] = [];
      if (current.ownerId !== next.ownerId) {
        history.push({ assetId: id, event: "ASSIGNED", fromValue: { ownerId: current.ownerId }, toValue: { ownerId: next.ownerId }, actorId: who.userId });
      }
      if (current.locationId !== next.locationId) {
        history.push({ assetId: id, event: "MOVED", fromValue: { locationId: current.locationId }, toValue: { locationId: next.locationId }, actorId: who.userId });
      }
      if (current.condition !== next.condition) {
        history.push({ assetId: id, event: "CONDITION_CHANGED", fromValue: { condition: current.condition }, toValue: { condition: next.condition }, actorId: who.userId });
      }
      if (Object.keys(changes).length) {
        history.push({ assetId: id, event: "UPDATED", toValue: changes, actorId: who.userId });
      }
      if (history.length) await tx.assetHistory.createMany({ data: history });

      await logAction({ ...who, action: "UPDATE", module: "asset", entityId: id, details: { assetCode: current.assetCode, changes } }, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e, "barcode")) return { fieldErrors: { barcode: ["บาร์โค้ดนี้ถูกใช้แล้ว"] } };
    throw e;
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  redirect(`/assets/${id}?updated=1`);
}

// ---------- Delete (soft) ----------

export async function deleteAsset(id: string): Promise<FormState> {
  const who = await actor("delete");
  const asset = await prisma.asset.findFirst({ where: { id, deletedAt: null }, select: { assetCode: true, name: true } });
  if (!asset) return { message: "ไม่พบครุภัณฑ์ หรือถูกลบไปแล้ว" };

  await prisma.$transaction(async (tx) => {
    await tx.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    await tx.assetHistory.create({ data: { assetId: id, event: "DELETED", actorId: who.userId } });
    await logAction({ ...who, action: "DELETE", module: "asset", entityId: id, details: { ...asset, soft: true } }, tx);
  });
  revalidatePath("/assets");
  return { ok: true, message: `ลบ ${asset.assetCode} เรียบร้อยแล้ว` };
}

// ---------- Bulk create ----------

export async function bulkCreateAssets(_prev: FormState<BulkCreateInput>, formData: FormData): Promise<FormState<BulkCreateInput>> {
  const who = await actor("create");
  const { fields, props } = splitForm(formData);
  const parsed = bulkCreateSchema.safeParse(fields);
  if (!parsed.success) return fieldErrors(parsed.error);
  const { quantity, serialNumbers, ...f } = parsed.data;

  if (serialNumbers.length && serialNumbers.length !== quantity) {
    return { fieldErrors: { serialNumbers: [`จำนวน Serial (${serialNumbers.length}) ต้องเท่ากับจำนวนที่สร้าง (${quantity})`] } };
  }
  if (new Set(serialNumbers).size !== serialNumbers.length) return { fieldErrors: { serialNumbers: ["มี Serial ซ้ำกัน"] } };

  const category = await prisma.assetCategory.findUnique({ where: { id: f.categoryId }, include: { propertyDefs: true } });
  if (!category) return { fieldErrors: { categoryId: ["ไม่พบประเภท"] } };
  const { values, errors } = validateProperties(category.propertyDefs, props);
  const refErrors = await checkReferences(f);
  if (Object.keys(errors).length || Object.keys(refErrors).length) {
    return { fieldErrors: { ...refErrors, ...propErrors(errors) } as FormState<BulkCreateInput>["fieldErrors"], message: "กรุณาตรวจสอบข้อมูลที่กรอก" };
  }

  const codes = await prisma.$transaction(async (tx) => {
    const codes = await nextAssetCodes(tx, category.codePrefix, quantity);
    for (const [i, assetCode] of codes.entries()) {
      const asset = await tx.asset.create({
        data: {
          ...assetData({ ...f, serialNumber: serialNumbers[i], barcode: undefined }),
          assetCode,
          categoryId: category.id,
          status: f.status,
          properties: { create: Object.entries(values).map(([key, value]) => ({ key, value })) },
        },
      });
      await tx.assetHistory.create({
        data: { assetId: asset.id, event: "CREATED", toValue: { assetCode, status: f.status }, refType: "BULK", actorId: who.userId },
      });
    }
    await logAction(
      { ...who, action: "BULK_CREATE", module: "asset", details: { category: category.codePrefix, quantity, from: codes[0], to: codes.at(-1) } },
      tx,
    );
    return codes;
  }, { timeout: 30_000 }); // up to 100 inserts

  revalidatePath("/assets");
  return { ok: true, message: `สร้างครุภัณฑ์ ${codes.length} รายการ (${codes[0]} ถึง ${codes.at(-1)})` };
}

// ---------- Import ----------

export type ImportPreview = {
  ok: boolean;
  message?: string;
  validCount: number;
  errors: RowError[];
};

export async function previewImport(payload: ImportPayload): Promise<ImportPreview> {
  await requirePermission("asset", "import");
  const parsed = importPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message, validCount: 0, errors: [] };
  const { prepared, errors } = await prepareImport(parsed.data);
  return { ok: errors.length === 0, validCount: prepared.length, errors };
}

/** All-or-nothing import: re-validates on the server and creates every row in one transaction. */
export async function commitImport(payload: ImportPayload): Promise<ImportPreview & { codes?: [string, string] }> {
  const session = await requirePermission("asset", "import");
  await requirePermission("asset", "create");
  const who = { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };

  const parsed = importPayloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message, validCount: 0, errors: [] };
  const { category, prepared, errors } = await prepareImport(parsed.data);
  if (!category || errors.length) return { ok: false, message: "มีแถวที่ไม่ผ่านการตรวจสอบ", validCount: prepared.length, errors };

  const codes = await prisma.$transaction(
    async (tx) => {
      const codes = await nextAssetCodes(tx, category.codePrefix, prepared.length);
      for (const [i, r] of prepared.entries()) {
        const asset = await tx.asset.create({
          data: {
            ...assetData(r.fields),
            assetCode: codes[i],
            categoryId: category.id,
            status: r.status,
            properties: { create: Object.entries(r.properties).map(([key, value]) => ({ key, value })) },
          },
        });
        await tx.assetHistory.create({
          data: { assetId: asset.id, event: "CREATED", toValue: { assetCode: codes[i], status: r.status }, refType: "IMPORT", actorId: who.userId },
        });
      }
      await logAction(
        { ...who, action: "IMPORT", module: "asset", details: { category: category.codePrefix, count: prepared.length, from: codes[0], to: codes.at(-1) } },
        tx,
      );
      return codes;
    },
    { timeout: 120_000 }, // up to MAX_IMPORT_ROWS inserts
  );

  revalidatePath("/assets");
  return { ok: true, validCount: prepared.length, errors: [], codes: [codes[0], codes.at(-1)!], message: `นำเข้า ${codes.length} รายการ (${codes[0]} ถึง ${codes.at(-1)})` };
}
