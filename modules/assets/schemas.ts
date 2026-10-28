import { z } from "zod";
import { initialAssetStatuses } from "@/lib/labels";

const optionalText = (max: number) => z.string().max(max, `ยาวเกิน ${max} ตัวอักษร`).optional();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง")
  .refine((v) => !Number.isNaN(Date.parse(v)), "วันที่ไม่ถูกต้อง")
  .optional();

export const assetConditions = ["GOOD", "FAIR", "DAMAGED"] as const;

/** Fields shared by create, edit, bulk and import */
export const assetFieldsSchema = z.object({
  name: z.string({ error: "กรุณากรอกชื่อครุภัณฑ์" }).min(1, "กรุณากรอกชื่อครุภัณฑ์").max(200, "ยาวเกิน 200 ตัวอักษร"),
  brand: optionalText(100),
  model: optionalText(100),
  serialNumber: optionalText(100),
  barcode: optionalText(100),
  purchaseDate: isoDate,
  warrantyExpiry: isoDate,
  cost: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "ราคาต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง")
    .optional(),
  condition: z.enum(assetConditions).default("GOOD"),
  ownerId: z.string().optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  note: optionalText(2000),
});

export const createAssetSchema = assetFieldsSchema.extend({
  categoryId: z.string({ error: "กรุณาเลือกประเภท" }).min(1, "กรุณาเลือกประเภท"),
  status: z.enum(initialAssetStatuses).default("SPARE"),
});

export const updateAssetSchema = assetFieldsSchema.extend({
  id: z.string().min(1),
});

export const bulkCreateSchema = createAssetSchema.omit({ serialNumber: true, barcode: true }).extend({
  quantity: z.coerce.number({ error: "กรุณากรอกจำนวน" }).int("จำนวนต้องเป็นจำนวนเต็ม").min(1, "อย่างน้อย 1").max(100, "ไม่เกิน 100 รายการต่อครั้ง"),
  serialNumbers: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

export type CreateAssetInput = z.input<typeof createAssetSchema>;
export type UpdateAssetInput = z.input<typeof updateAssetSchema>;
export type BulkCreateInput = z.input<typeof bulkCreateSchema>;
export type AssetFields = z.output<typeof assetFieldsSchema>;

/** Form field name prefix for dynamic category properties, e.g. "prop.ram_gb" */
export const PROP_PREFIX = "prop.";
