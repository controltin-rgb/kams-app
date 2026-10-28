import { z } from "zod";

const isoDate = z.string({ error: "กรุณาระบุวันที่" }).regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
const idList = (msg: string) =>
  z
    .string({ error: msg })
    .transform((v) => [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))])
    .pipe(z.array(z.string()).min(1, msg).max(200));

export const campaignSchema = z
  .object({
    id: z.string().optional(),
    title: z.string({ error: "กรุณากรอกชื่อรอบตรวจนับ" }).min(1, "กรุณากรอกชื่อรอบตรวจนับ").max(200),
    year: z.coerce.number({ error: "กรุณากรอกปี" }).int().min(2000).max(2200),
    startDate: isoDate,
    endDate: isoDate,
    scopeLocationIds: idList("กรุณาเลือกสถานที่อย่างน้อย 1 แห่ง"),
    auditorIds: idList("กรุณาเลือกผู้ตรวจนับอย่างน้อย 1 คน"),
    note: z.string().max(2000).optional(),
  })
  .refine((d) => d.endDate >= d.startDate, { path: ["endDate"], message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" });
export type CampaignInput = z.input<typeof campaignSchema>;

export const scanSchema = z.object({
  clientUuid: z.uuid(),
  code: z.string().trim().min(1).max(200),
  actualLocationId: z.string().max(40).nullable().optional(),
  condition: z.enum(["GOOD", "FAIR", "DAMAGED"]).default("GOOD"),
  notes: z.string().max(500).optional(),
  scannedAt: z.iso.datetime(),
});
export type ScanInput = z.infer<typeof scanSchema>;

export const syncSchema = z.object({
  campaignId: z.string().min(1),
  scans: z.array(scanSchema).min(1).max(500),
});
export type SyncInput = z.infer<typeof syncSchema>;
