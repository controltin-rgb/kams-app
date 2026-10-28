import { z } from "zod";
import { returnStatuses } from "@/lib/labels";

const optionalId = z.string().optional();
const reason = z.string().max(2000, "ยาวเกิน 2000 ตัวอักษร").optional();

/** Optional receiver signature captured on screen (PNG data URL, max ~300 KB) */
export const signatureFields = {
  signature: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "ลายเซ็นไม่ถูกต้อง")
    .max(400_000, "ลายเซ็นใหญ่เกินไป")
    .optional(),
  signedByName: z.string().max(100, "ยาวเกิน 100 ตัวอักษร").optional(),
};

const assetIdsField = z
  .string({ error: "กรุณาเลือกครุภัณฑ์" })
  .min(1, "กรุณาเลือกครุภัณฑ์")
  .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))])
  .pipe(z.array(z.string()).min(1, "กรุณาเลือกครุภัณฑ์").max(100, "ไม่เกิน 100 รายการต่อเอกสาร"));

export const transferSchema = z
  .object({
    type: z.enum(["HANDOVER", "RETURN", "MOVE"]),
    assetIds: assetIdsField,
    toOwnerId: optionalId,
    toDepartmentId: optionalId,
    toLocationId: optionalId,
    returnStatus: z.enum(returnStatuses).default("SPARE"),
    reason,
    ...signatureFields,
  })
  .refine((d) => d.type !== "HANDOVER" || !!d.toOwnerId, { path: ["toOwnerId"], message: "กรุณาเลือกผู้รับมอบ" })
  .refine((d) => d.type !== "RETURN" || !!d.toLocationId, { path: ["toLocationId"], message: "กรุณาเลือกสถานที่เก็บ" })
  .refine((d) => d.type !== "MOVE" || !!d.toLocationId || !!d.toDepartmentId, { path: ["toLocationId"], message: "กรุณาเลือกสถานที่หรือแผนกปลายทาง" })
  .refine((d) => !d.signature || !!d.signedByName, { path: ["signedByName"], message: "กรุณากรอกชื่อผู้ลงนาม" });

export const partialSwapSchema = z
  .object({
    parentId: z.string({ error: "กรุณาเลือกชุดอุปกรณ์" }).min(1, "กรุณาเลือกชุดอุปกรณ์"),
    oldChildId: z.string({ error: "กรุณาเลือกชิ้นที่ถอดออก" }).min(1, "กรุณาเลือกชิ้นที่ถอดออก"),
    newChildId: z.string({ error: "กรุณาเลือกชิ้นใหม่" }).min(1, "กรุณาเลือกชิ้นใหม่"),
    oldStatus: z.enum(returnStatuses).default("SPARE"),
    oldLocationId: optionalId,
    ticketId: optionalId,
    reason,
    ...signatureFields,
  })
  .refine((d) => d.oldChildId !== d.newChildId, { path: ["newChildId"], message: "ต้องเป็นคนละชิ้นกัน" })
  .refine((d) => !d.signature || !!d.signedByName, { path: ["signedByName"], message: "กรุณากรอกชื่อผู้ลงนาม" });

export const fullSwapSchema = z
  .object({
    oldParentId: z.string({ error: "กรุณาเลือกชุดเดิม" }).min(1, "กรุณาเลือกชุดเดิม"),
    newParentId: z.string({ error: "กรุณาเลือกชุดใหม่" }).min(1, "กรุณาเลือกชุดใหม่"),
    oldStatus: z.enum(returnStatuses).default("SPARE"),
    oldLocationId: z.string({ error: "กรุณาเลือกสถานที่เก็บชุดเดิม" }).min(1, "กรุณาเลือกสถานที่เก็บชุดเดิม"),
    ticketId: optionalId,
    reason,
    ...signatureFields,
  })
  .refine((d) => d.oldParentId !== d.newParentId, { path: ["newParentId"], message: "ต้องเป็นคนละชุดกัน" })
  .refine((d) => !d.signature || !!d.signedByName, { path: ["signedByName"], message: "กรุณากรอกชื่อผู้ลงนาม" });

export const attachSchema = z.object({
  parentId: z.string().min(1),
  childId: z.string({ error: "กรุณาเลือกครุภัณฑ์" }).min(1, "กรุณาเลือกครุภัณฑ์"),
  type: z.enum(["COMPONENT", "ACCESSORY", "SOFTWARE"]).default("COMPONENT"),
});

export const detachSchema = z.object({
  relationshipId: z.string().min(1),
  status: z.enum(returnStatuses).default("SPARE"),
  locationId: optionalId,
});

export const signSchema = z.object({
  transferId: z.string().min(1),
  signature: signatureFields.signature.unwrap(),
  signedByName: z.string({ error: "กรุณากรอกชื่อผู้ลงนาม" }).min(1, "กรุณากรอกชื่อผู้ลงนาม").max(100),
});

export type TransferInput = z.input<typeof transferSchema>;
export type PartialSwapInput = z.input<typeof partialSwapSchema>;
export type FullSwapInput = z.input<typeof fullSwapSchema>;
export type AttachInput = z.input<typeof attachSchema>;
export type DetachInput = z.input<typeof detachSchema>;
export type SignInput = z.input<typeof signSchema>;
