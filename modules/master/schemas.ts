import { z } from "zod";
import { locationTypeOrder } from "@/lib/labels";
import { ASSET_MODELS } from "@/modules/office3d/models";

const optionalText = (max: number, msg = `ยาวเกิน ${max} ตัวอักษร`) => z.string().max(max, msg).optional();
const checkbox = z
  .literal("true")
  .optional()
  .transform((v) => v === "true");

export const departmentSchema = z.object({
  id: z.string().optional(),
  name: z.string({ error: "กรุณากรอกชื่อแผนก" }).min(1, "กรุณากรอกชื่อแผนก").max(100, "ชื่อยาวเกิน 100 ตัวอักษร"),
  code: optionalText(20),
});

export const vendorSchema = z.object({
  id: z.string().optional(),
  name: z.string({ error: "กรุณากรอกชื่อผู้ขาย" }).min(1, "กรุณากรอกชื่อผู้ขาย").max(200, "ชื่อยาวเกิน 200 ตัวอักษร"),
  contact: optionalText(100),
  phone: optionalText(50),
  email: z.email("รูปแบบอีเมลไม่ถูกต้อง").optional(),
  address: optionalText(500),
  note: optionalText(1000),
});

export const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string({ error: "กรุณากรอกชื่อสถานที่" }).min(1, "กรุณากรอกชื่อสถานที่").max(100, "ชื่อยาวเกิน 100 ตัวอักษร"),
  type: z.enum(locationTypeOrder, { error: "กรุณาเลือกระดับ" }),
  parentId: z.string().optional(),
  /** 3D Office layout item id (only applied for office3d.configureLayout) */
  sceneSlot: z.string().max(60).optional(),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string({ error: "กรุณากรอกชื่อประเภท" }).min(1, "กรุณากรอกชื่อประเภท").max(100, "ชื่อยาวเกิน 100 ตัวอักษร"),
  codePrefix: z
    .string({ error: "กรุณากรอกรหัสนำหน้า" })
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,6}$/, "ใช้ A-Z หรือ 0-9 จำนวน 2-6 ตัว")),
  description: optionalText(500),
  /** 3D Office model key (only applied for office3d.configureLayout); empty = generic equipment */
  sceneModel: z.enum(ASSET_MODELS).optional(),
});

export const propertyTypes = ["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"] as const;

export const propertyDefSchema = z
  .object({
    id: z.string().optional(),
    categoryId: z.string().min(1),
    key: z
      .string({ error: "กรุณากรอก key" })
      .regex(/^[a-z][a-z0-9_]{0,39}$/, "ใช้ a-z, 0-9, _ ขึ้นต้นด้วยตัวอักษร (ไม่เกิน 40 ตัว)"),
    label: z.string({ error: "กรุณากรอกชื่อที่แสดง" }).min(1, "กรุณากรอกชื่อที่แสดง").max(100, "ยาวเกิน 100 ตัวอักษร"),
    type: z.enum(propertyTypes, { error: "กรุณาเลือกชนิดข้อมูล" }),
    required: checkbox,
    options: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
  })
  .refine((d) => d.type !== "SELECT" || d.options.length > 0, {
    path: ["options"],
    message: "ชนิดตัวเลือกต้องมีอย่างน้อย 1 ตัวเลือก",
  });

export type DepartmentInput = z.input<typeof departmentSchema>;
export type VendorInput = z.input<typeof vendorSchema>;
export type LocationInput = z.input<typeof locationSchema>;
export type CategoryInput = z.input<typeof categorySchema>;
export type PropertyDefInput = z.input<typeof propertyDefSchema>;
