"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { deleteStoredFile, saveFile, sniffType } from "@/lib/storage";
import { labelDesignSchema, layoutSchema, paperPresets, type LabelDesign, type LabelLayout } from "./design";
import { defaultAssetDesign } from "./defaults";

async function actor(action: "create" | "update" | "delete") {
  const session = await requirePermission("label", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy };
}

const createSchema = z.object({
  name: z.string({ error: "กรุณากรอกชื่อแม่แบบ" }).min(1, "กรุณากรอกชื่อแม่แบบ").max(100, "ยาวเกิน 100 ตัวอักษร"),
  kind: z.enum(["ASSET", "STATUS"]).default("ASSET"),
  paperPreset: z.enum(Object.keys(paperPresets) as [string, ...string[]]).default("A4_4x10"),
});
export type CreateTemplateInput = z.input<typeof createSchema>;

export async function createTemplate(_prev: FormState<CreateTemplateInput>, formData: FormData): Promise<FormState<CreateTemplateInput>> {
  const who = await actor("create");
  const parsed = createSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { name, kind, paperPreset } = parsed.data;
  const { label: _label, ...layout } = paperPresets[paperPreset];
  void _label;

  // Status stickers start with a single centred text; asset labels with the standard layout (scaled to the label)
  const scale = Math.min(layout.labelWidthMm / 48.5, layout.labelHeightMm / 25.4);
  const elements: LabelDesign["elements"] =
    kind === "ASSET"
      ? defaultAssetDesign.map((e) => ({ ...e, x: e.x * scale, y: e.y * scale, w: e.w * scale, h: e.h * scale }))
      : [{ id: "title", type: "text", text: "ข้อความ", x: 2, y: 2, w: layout.labelWidthMm - 4, h: layout.labelHeightMm - 4, rotation: 0, fontSize: 12, bold: true, align: "center", color: "#000000" }];

  const t = await prisma.$transaction(async (tx) => {
    const t = await tx.labelTemplate.create({ data: { name, kind, paperPreset, ...layout, design: { elements } } });
    await logAction({ ...who, action: "CREATE", module: "label", entityId: t.id, details: { name, kind, paperPreset } }, tx);
    return t;
  });
  revalidatePath("/labels");
  return { ok: true, message: "สร้างแม่แบบแล้ว", data: { id: t.id } };
}

/** Save from the editor: name, layout and design are validated with the shared schemas. */
export async function saveTemplate(input: { id: string; name: string; paperPreset: string; layout: LabelLayout; design: LabelDesign }): Promise<FormState> {
  const who = await actor("update");
  const name = z.string().min(1).max(100).safeParse(input.name.trim());
  if (!name.success) return { message: "กรุณากรอกชื่อแม่แบบ (ไม่เกิน 100 ตัวอักษร)" };
  const layout = layoutSchema.safeParse(input.layout);
  if (!layout.success) return { message: "ขนาดกระดาษ/ฉลากไม่ถูกต้อง" };
  const design = labelDesignSchema.safeParse(input.design);
  if (!design.success) return { message: "ข้อมูลการออกแบบไม่ถูกต้อง" };
  const l = layout.data;
  if (l.marginLeftMm + l.columns * l.labelWidthMm + (l.columns - 1) * l.gapXMm > l.pageWidthMm + 0.5 || l.marginTopMm + l.rows * l.labelHeightMm + (l.rows - 1) * l.gapYMm > l.pageHeightMm + 0.5) {
    return { message: "ฉลากล้นขอบกระดาษ — ตรวจสอบจำนวนแถว/คอลัมน์ ขนาด และระยะขอบ" };
  }
  const preset = input.paperPreset in paperPresets ? input.paperPreset : "CUSTOM";

  await prisma.$transaction(async (tx) => {
    await tx.labelTemplate.update({
      where: { id: input.id, deletedAt: null },
      data: { name: name.data, paperPreset: preset, ...l, design: design.data as Prisma.InputJsonValue },
    });
    await logAction({ ...who, action: "UPDATE", module: "label", entityId: input.id, details: { name: name.data, elements: design.data.elements.length } }, tx);
  });
  revalidatePath("/labels");
  revalidatePath(`/labels/${input.id}`);
  return { ok: true, message: "บันทึกแม่แบบแล้ว" };
}

export async function duplicateTemplate(id: string): Promise<FormState> {
  const who = await actor("create");
  const src = await prisma.labelTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!src) return { message: "ไม่พบแม่แบบ" };
  const { id: _id, createdAt: _c, updatedAt: _u, isDefault: _d, deletedAt: _x, design, ...rest } = src;
  void [_id, _c, _u, _d, _x];
  const copy = await prisma.$transaction(async (tx) => {
    const copy = await tx.labelTemplate.create({ data: { ...rest, name: `${src.name} (สำเนา)`, design: design as Prisma.InputJsonValue } });
    await logAction({ ...who, action: "DUPLICATE", module: "label", entityId: copy.id, details: { from: id } }, tx);
    return copy;
  });
  revalidatePath("/labels");
  return { ok: true, message: "ทำสำเนาแล้ว", data: { id: copy.id } };
}

export async function deleteTemplate(id: string): Promise<FormState> {
  const who = await actor("delete");
  const t = await prisma.labelTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!t) return { message: "ไม่พบแม่แบบ" };
  if (t.isDefault) return { message: "ลบแม่แบบเริ่มต้นไม่ได้ — ตั้งแม่แบบอื่นเป็นค่าเริ่มต้นก่อน" };
  await prisma.$transaction(async (tx) => {
    await tx.labelTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAction({ ...who, action: "DELETE", module: "label", entityId: id, details: { name: t.name, soft: true } }, tx);
  });
  revalidatePath("/labels");
  return { ok: true, message: "ลบแม่แบบแล้ว" };
}

export async function setDefaultTemplate(id: string): Promise<FormState> {
  const who = await actor("update");
  const t = await prisma.labelTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!t) return { message: "ไม่พบแม่แบบ" };
  await prisma.$transaction(async (tx) => {
    await tx.labelTemplate.updateMany({ where: { kind: t.kind, isDefault: true }, data: { isDefault: false } });
    await tx.labelTemplate.update({ where: { id }, data: { isDefault: true } });
    await logAction({ ...who, action: "SET_DEFAULT", module: "label", entityId: id, details: { name: t.name } }, tx);
  });
  revalidatePath("/labels");
  return { ok: true, message: `ตั้ง "${t.name}" เป็นค่าเริ่มต้นแล้ว` };
}

/** Upload a logo/image for a template (PNG/JPG/WEBP ≤ 2 MB). Returns the attachment id in `data.id`. */
export async function uploadLabelImage(formData: FormData): Promise<FormState> {
  const who = await actor("update");
  const templateId = String(formData.get("templateId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "ไม่พบไฟล์" };
  if (file.size > 2 * 1024 * 1024) return { message: "รูปใหญ่เกิน 2 MB" };
  const template = await prisma.labelTemplate.findFirst({ where: { id: templateId, deletedAt: null }, select: { id: true } });
  if (!template) return { message: "ไม่พบแม่แบบ" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buffer);
  if (!type || !["image/png", "image/jpeg", "image/webp"].includes(type.mime)) return { message: "รองรับเฉพาะ PNG, JPG, WEBP" };
  const storageKey = await saveFile(buffer, type.ext);
  try {
    const att = await prisma.$transaction(async (tx) => {
      const att = await tx.attachment.create({
        data: { storageKey, filename: file.name.slice(0, 200), mime: type.mime, size: buffer.length, uploadedById: who.userId, labelTemplateId: templateId },
      });
      await logAction({ ...who, action: "UPLOAD_IMAGE", module: "label", entityId: templateId, details: { attachmentId: att.id } }, tx);
      return att;
    });
    return { ok: true, message: "อัปโหลดรูปแล้ว", data: { id: att.id } };
  } catch (e) {
    await deleteStoredFile(storageKey);
    throw e;
  }
}

/** Audit record for a print job (printing itself happens in the browser). */
export async function logLabelPrint(input: { templateId: string; assetIds: string[]; copies: number; offset: number; total: number }): Promise<FormState> {
  const session = await requirePermission("label", "view");
  const template = await prisma.labelTemplate.findFirst({ where: { id: input.templateId, deletedAt: null }, select: { kind: true, name: true } });
  if (!template) return { message: "ไม่พบแม่แบบ" };
  if (template.kind === "ASSET") await requirePermission("asset", "printLabel");
  await logAction({
    userId: session.user.id,
    impersonatedBy: session.session.impersonatedBy,
    action: "PRINT",
    module: "label",
    entityId: input.templateId,
    details: { template: template.name, assets: input.assetIds.length, copies: input.copies, offset: input.offset, total: input.total },
  });
  return { ok: true };
}

/** Label data for the selected assets (print preview). */
export async function getLabelData(assetIds: string[]) {
  await requirePermission("asset", "printLabel");
  const ids = z.array(z.string().max(40)).max(1000).parse(assetIds);
  const { labelDataForAssets } = await import("./queries");
  return labelDataForAssets(ids);
}
