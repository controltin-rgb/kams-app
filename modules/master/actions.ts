"use server";

import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { locationTypeOrder } from "@/lib/labels";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { getSession, requirePermission } from "@/lib/session";
import { getActiveLayout } from "@/modules/office3d/layout";
import { slotOptions } from "@/modules/office3d/scene";
import {
  categorySchema,
  departmentSchema,
  locationSchema,
  propertyDefSchema,
  vendorSchema,
  type CategoryInput,
  type DepartmentInput,
  type LocationInput,
  type PropertyDefInput,
  type VendorInput,
} from "./schemas";

async function actor(action: "create" | "update" | "delete") {
  const session = await requirePermission("masterData", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

/** 3D Office fields are applied only when the form sent them and the user may configure the scene layout. */
async function sceneConfigurable(formData: FormData, field: string) {
  if (!formData.has(field)) return false;
  const session = await getSession();
  return can(session?.user.role, "office3d", "configureLayout");
}

// ---------- Department ----------

export async function saveDepartment(_prev: FormState<DepartmentInput>, formData: FormData): Promise<FormState<DepartmentInput>> {
  const parsed = departmentSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, name, code } = parsed.data;
  const who = await actor(id ? "update" : "create");

  try {
    await prisma.$transaction(async (tx) => {
      const row = id
        ? await tx.department.update({ where: { id }, data: { name, code: code ?? null } })
        : await tx.department.create({ data: { name, code: code ?? null } });
      await logAction({ ...who, action: id ? "UPDATE" : "CREATE", module: "department", entityId: row.id, details: { name, code } }, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e, "code")) return { fieldErrors: { code: ["รหัสนี้ถูกใช้แล้ว"] } };
    if (isUniqueViolation(e)) return { fieldErrors: { name: ["ชื่อแผนกนี้มีอยู่แล้ว"] } };
    throw e;
  }
  revalidatePath("/master/departments");
  return { ok: true, message: id ? "แก้ไขแผนกเรียบร้อยแล้ว" : "เพิ่มแผนกเรียบร้อยแล้ว" };
}

export async function deleteDepartment(id: string): Promise<FormState> {
  const who = await actor("delete");
  const usage = await prisma.department.findUnique({
    where: { id },
    select: { name: true, _count: { select: { users: true, assets: true } } },
  });
  if (!usage) return { message: "ไม่พบข้อมูล" };
  if (usage._count.users || usage._count.assets) {
    return { message: `ลบไม่ได้: มีผู้ใช้ ${usage._count.users} คน และครุภัณฑ์ ${usage._count.assets} รายการอยู่ในแผนกนี้` };
  }
  await prisma.$transaction(async (tx) => {
    await tx.department.delete({ where: { id } });
    await logAction({ ...who, action: "DELETE", module: "department", entityId: id, details: { name: usage.name } }, tx);
  });
  revalidatePath("/master/departments");
  return { ok: true, message: "ลบแผนกเรียบร้อยแล้ว" };
}

// ---------- Vendor ----------

export async function saveVendor(_prev: FormState<VendorInput>, formData: FormData): Promise<FormState<VendorInput>> {
  const parsed = vendorSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, ...input } = parsed.data;
  const who = await actor(id ? "update" : "create");
  const data = {
    name: input.name,
    contact: input.contact ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    note: input.note ?? null,
  };

  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.vendor.update({ where: { id, deletedAt: null }, data }) : await tx.vendor.create({ data });
    await logAction({ ...who, action: id ? "UPDATE" : "CREATE", module: "vendor", entityId: row.id, details: data }, tx);
  });
  revalidatePath("/master/vendors");
  return { ok: true, message: id ? "แก้ไขผู้ขายเรียบร้อยแล้ว" : "เพิ่มผู้ขายเรียบร้อยแล้ว" };
}

export async function deleteVendor(id: string): Promise<FormState> {
  const who = await actor("delete");
  await prisma.$transaction(async (tx) => {
    const row = await tx.vendor.update({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    await logAction({ ...who, action: "DELETE", module: "vendor", entityId: id, details: { name: row.name, soft: true } }, tx);
  });
  revalidatePath("/master/vendors");
  return { ok: true, message: "ลบผู้ขายเรียบร้อยแล้ว" };
}

// ---------- Location ----------

export async function saveLocation(_prev: FormState<LocationInput>, formData: FormData): Promise<FormState<LocationInput>> {
  const parsed = locationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, name, type, parentId, sceneSlot } = parsed.data;
  const who = await actor(id ? "update" : "create");
  const withScene = await sceneConfigurable(formData, "sceneSlot");
  if (withScene && sceneSlot && !slotOptions((await getActiveLayout()).config.items).some((s) => s.id === sceneSlot)) {
    return { fieldErrors: { sceneSlot: ["ไม่พบตำแหน่งนี้ในผังสำนักงาน"] } };
  }

  if (parentId) {
    const parent = await prisma.location.findFirst({ where: { id: parentId, deletedAt: null } });
    if (!parent) return { fieldErrors: { parentId: ["ไม่พบสถานที่หลัก"] } };
    if (locationTypeOrder.indexOf(type) <= locationTypeOrder.indexOf(parent.type)) {
      return { fieldErrors: { type: ["ระดับต้องต่ำกว่าสถานที่หลัก (อาคาร → ชั้น → ห้อง → จุด)"] } };
    }
    if (id) {
      // Prevent cycles: the new parent must not be this node or one of its descendants
      let cursor: string | null = parentId;
      while (cursor) {
        if (cursor === id) return { fieldErrors: { parentId: ["ไม่สามารถเลือกตัวเองหรือสถานที่ย่อยเป็นสถานที่หลักได้"] } };
        const next: { parentId: string | null } | null = await prisma.location.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = next?.parentId ?? null;
      }
    }
  }
  if (id) {
    const deeperChild = await prisma.location.findFirst({
      where: { parentId: id, deletedAt: null, type: { in: locationTypeOrder.slice(0, locationTypeOrder.indexOf(type) + 1) } },
    });
    if (deeperChild) return { fieldErrors: { type: ["มีสถานที่ย่อยที่ระดับไม่ต่ำกว่าระดับนี้"] } };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const data = { name, type, parentId: parentId ?? null, ...(withScene && { sceneSlot: sceneSlot ?? null }) };
      const row = id ? await tx.location.update({ where: { id, deletedAt: null }, data }) : await tx.location.create({ data });
      await logAction({ ...who, action: id ? "UPDATE" : "CREATE", module: "location", entityId: row.id, details: data }, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e, "sceneSlot")) return { fieldErrors: { sceneSlot: ["ตำแหน่งนี้ผูกกับสถานที่อื่นแล้ว"] } };
    throw e;
  }
  revalidatePath("/master/locations");
  return { ok: true, message: id ? "แก้ไขสถานที่เรียบร้อยแล้ว" : "เพิ่มสถานที่เรียบร้อยแล้ว" };
}

export async function deleteLocation(id: string): Promise<FormState> {
  const who = await actor("delete");
  const [children, assets] = await Promise.all([
    prisma.location.count({ where: { parentId: id, deletedAt: null } }),
    prisma.asset.count({ where: { locationId: id, deletedAt: null } }),
  ]);
  if (children) return { message: `ลบไม่ได้: มีสถานที่ย่อย ${children} รายการ` };
  if (assets) return { message: `ลบไม่ได้: มีครุภัณฑ์ ${assets} รายการอยู่ที่นี่` };

  await prisma.$transaction(async (tx) => {
    const row = await tx.location.update({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    await logAction({ ...who, action: "DELETE", module: "location", entityId: id, details: { name: row.name, soft: true } }, tx);
  });
  revalidatePath("/master/locations");
  return { ok: true, message: "ลบสถานที่เรียบร้อยแล้ว" };
}

// ---------- Category & properties ----------

export async function saveCategory(_prev: FormState<CategoryInput>, formData: FormData): Promise<FormState<CategoryInput>> {
  const parsed = categorySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, name, codePrefix, description, sceneModel } = parsed.data;
  const who = await actor(id ? "update" : "create");
  const withScene = await sceneConfigurable(formData, "sceneModel");

  if (id) {
    const current = await prisma.assetCategory.findUnique({ where: { id }, select: { codePrefix: true, _count: { select: { assets: true } } } });
    if (current && current.codePrefix !== codePrefix && current._count.assets > 0) {
      return { fieldErrors: { codePrefix: ["เปลี่ยนรหัสนำหน้าไม่ได้ เพราะมีครุภัณฑ์ใช้รหัสนี้แล้ว"] } };
    }
  }

  let savedId = id;
  try {
    await prisma.$transaction(async (tx) => {
      const data = { name, codePrefix, description: description ?? null, ...(withScene && { sceneModel: sceneModel ?? null }) };
      const row = id ? await tx.assetCategory.update({ where: { id }, data }) : await tx.assetCategory.create({ data });
      savedId = row.id;
      await logAction({ ...who, action: id ? "UPDATE" : "CREATE", module: "category", entityId: row.id, details: data }, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e, "codePrefix")) return { fieldErrors: { codePrefix: ["รหัสนำหน้านี้ถูกใช้แล้ว"] } };
    if (isUniqueViolation(e)) return { fieldErrors: { name: ["ชื่อประเภทนี้มีอยู่แล้ว"] } };
    throw e;
  }
  revalidatePath("/master/categories");
  return { ok: true, message: id ? "แก้ไขประเภทเรียบร้อยแล้ว" : "เพิ่มประเภทเรียบร้อยแล้ว", data: { id: savedId } };
}

export async function deleteCategory(id: string): Promise<FormState> {
  const who = await actor("delete");
  const category = await prisma.assetCategory.findUnique({ where: { id }, select: { name: true, _count: { select: { assets: true } } } });
  if (!category) return { message: "ไม่พบข้อมูล" };
  if (category._count.assets) return { message: `ลบไม่ได้: มีครุภัณฑ์ ${category._count.assets} รายการในประเภทนี้` };

  await prisma.$transaction(async (tx) => {
    await tx.assetCategory.delete({ where: { id } });
    await logAction({ ...who, action: "DELETE", module: "category", entityId: id, details: { name: category.name } }, tx);
  });
  revalidatePath("/master/categories");
  return { ok: true, message: "ลบประเภทเรียบร้อยแล้ว" };
}

export async function savePropertyDef(_prev: FormState<PropertyDefInput>, formData: FormData): Promise<FormState<PropertyDefInput>> {
  const parsed = propertyDefSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { id, categoryId, ...input } = parsed.data;
  const who = await actor("update");
  const data = { ...input, options: input.type === "SELECT" ? input.options : [] };

  try {
    await prisma.$transaction(async (tx) => {
      const row = id
        ? await tx.propertyDefinition.update({ where: { id, categoryId }, data })
        : await tx.propertyDefinition.create({ data: { ...data, categoryId } });
      await logAction(
        { ...who, action: id ? "UPDATE_PROPERTY" : "CREATE_PROPERTY", module: "category", entityId: categoryId, details: { propertyId: row.id, ...data } },
        tx,
      );
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { fieldErrors: { key: ["key นี้มีอยู่แล้วในประเภทนี้"] } };
    throw e;
  }
  revalidatePath(`/master/categories/${categoryId}`);
  return { ok: true, message: id ? "แก้ไข property เรียบร้อยแล้ว" : "เพิ่ม property เรียบร้อยแล้ว" };
}

export async function deletePropertyDef(id: string): Promise<FormState> {
  const who = await actor("update");
  await prisma.$transaction(async (tx) => {
    const row = await tx.propertyDefinition.delete({ where: { id } });
    await logAction(
      { ...who, action: "DELETE_PROPERTY", module: "category", entityId: row.categoryId, details: { propertyId: id, key: row.key } },
      tx,
    );
    revalidatePath(`/master/categories/${row.categoryId}`);
  });
  return { ok: true, message: "ลบ property เรียบร้อยแล้ว (ค่าเดิมในครุภัณฑ์ยังเก็บไว้)" };
}
