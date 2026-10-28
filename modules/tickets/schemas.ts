import { z } from "zod";

export const ticketCategories = ["IT", "FACILITY", "GENERAL"] as const;
export const ticketPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const ticketStatuses = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED", "CANCELLED"] as const;

const checkbox = z
  .literal("true")
  .optional()
  .transform((v) => v === "true");
const money = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "จำนวนเงินไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)");

const ticketBase = z.object({
  category: z.enum(ticketCategories).default("IT"),
  priority: z.enum(ticketPriorities).default("MEDIUM"),
  title: z.string({ error: "กรุณากรอกหัวข้อ" }).min(3, "หัวข้ออย่างน้อย 3 ตัวอักษร").max(200, "หัวข้อยาวเกิน 200 ตัวอักษร"),
  description: z.string().max(5000, "รายละเอียดยาวเกิน 5000 ตัวอักษร").optional(),
  locationText: z.string().max(200, "ยาวเกิน 200 ตัวอักษร").optional(),
  assetUnusable: checkbox,
});

export const createTicketSchema = ticketBase.extend({
  assetId: z.string().optional(),
  /** Set when opened from a QR scan */
  fromQr: checkbox,
});

/** Public QR report (no login) — reporter identifies themselves; `website` is a honeypot */
export const publicTicketSchema = ticketBase.omit({ priority: true, category: true }).extend({
  assetCode: z.string().min(1),
  reporterName: z.string({ error: "กรุณากรอกชื่อผู้แจ้ง" }).min(2, "กรุณากรอกชื่อผู้แจ้ง").max(100),
  reporterContact: z.string({ error: "กรุณากรอกเบอร์โทรหรืออีเมล" }).min(5, "กรุณากรอกเบอร์โทรหรืออีเมล").max(100),
  website: z.string().max(0).optional(),
});

export const statusChangeSchema = z
  .object({
    ticketId: z.string().min(1),
    status: z.enum(ticketStatuses),
    note: z.string().max(2000).optional(),
    resolution: z.string().max(5000).optional(),
  })
  .refine((d) => d.status !== "RESOLVED" || !!d.resolution, { path: ["resolution"], message: "กรุณาระบุวิธีแก้ไข" })
  .refine((d) => d.status !== "CANCELLED" || !!d.note, { path: ["note"], message: "กรุณาระบุเหตุผลที่ยกเลิก" });

export const assignSchema = z.object({ ticketId: z.string().min(1), assignedTechId: z.string().optional() });
export const prioritySchema = z.object({ ticketId: z.string().min(1), priority: z.enum(ticketPriorities) });

export const commentSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string({ error: "กรุณาพิมพ์ข้อความ" }).min(1, "กรุณาพิมพ์ข้อความ").max(5000, "ข้อความยาวเกินไป"),
  internal: checkbox,
});

export const repairInfoSchema = z.object({
  ticketId: z.string().min(1),
  cause: z.string().max(5000).optional(),
  resolution: z.string().max(5000).optional(),
  laborCost: money.optional(),
});

export const partSchema = z.object({
  ticketId: z.string().min(1),
  name: z.string({ error: "กรุณากรอกชื่ออะไหล่" }).min(1, "กรุณากรอกชื่ออะไหล่").max(200),
  qty: z.coerce.number({ error: "จำนวนไม่ถูกต้อง" }).int("ต้องเป็นจำนวนเต็ม").min(1, "อย่างน้อย 1").max(9999),
  unitCost: money,
});

export type CreateTicketInput = z.input<typeof createTicketSchema>;
export type PublicTicketInput = z.input<typeof publicTicketSchema>;
export type StatusChangeInput = z.input<typeof statusChangeSchema>;
export type CommentInput = z.input<typeof commentSchema>;
export type RepairInfoInput = z.input<typeof repairInfoSchema>;
export type PartInput = z.input<typeof partSchema>;
