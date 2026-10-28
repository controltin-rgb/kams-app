import { z } from "zod";

export const pmFrequencies = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;
export const checklistItemTypes = ["CHECK", "NUMBER", "TEXT"] as const;

export const checklistItemSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "กรุณากรอกรายการตรวจ").max(200),
  type: z.enum(checklistItemTypes).default("CHECK"),
  unit: z.string().max(20).optional(),
  required: z.boolean().default(true),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const checklistSchema = z.array(checklistItemSchema).min(1, "ต้องมีรายการตรวจอย่างน้อย 1 รายการ").max(50, "ไม่เกิน 50 รายการ");

const isoDate = z.string({ error: "กรุณาระบุวันที่" }).regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");

export const scheduleSchema = z.object({
  id: z.string().optional(),
  title: z.string({ error: "กรุณากรอกชื่อแผน" }).min(1, "กรุณากรอกชื่อแผน").max(200, "ยาวเกิน 200 ตัวอักษร"),
  description: z.string().max(2000).optional(),
  assetId: z.string().optional(),
  locationId: z.string().optional(),
  frequency: z.enum(pmFrequencies, { error: "กรุณาเลือกความถี่" }),
  startDate: isoDate,
  assignedTechId: z.string().optional(),
  active: z
    .literal("true")
    .optional()
    .transform((v) => v === "true"),
  /** JSON array of checklist items (built by the client editor) */
  checklist: z
    .string({ error: "กรุณาเพิ่มรายการตรวจ" })
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "รายการตรวจไม่ถูกต้อง" });
        return z.NEVER;
      }
    })
    .pipe(checklistSchema),
});
export type ScheduleInput = z.input<typeof scheduleSchema>;

/** One answer per checklist item; `value` is "pass"/"fail" for CHECK items */
export const runResultSchema = z.object({
  itemId: z.string(),
  value: z.string().max(500).default(""),
});

export const completeRunSchema = z.object({
  runId: z.string().min(1),
  results: z.array(runResultSchema).max(50),
  notes: z.string().max(2000).optional(),
});
export type CompleteRunInput = z.infer<typeof completeRunSchema>;

export type ChecklistResult = { itemId: string; label: string; type: ChecklistItem["type"]; unit?: string; value: string; pass: boolean | null };
