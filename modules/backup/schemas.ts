import { z } from "zod";

export const restoreSchema = z.object({
  name: z.string().min(1),
  confirm: z.string({ error: "พิมพ์ชื่อฐานข้อมูลเพื่อยืนยัน" }).trim().min(1, "พิมพ์ชื่อฐานข้อมูลเพื่อยืนยัน"),
});
export type RestoreInput = z.input<typeof restoreSchema>;

export const backupSettingsSchema = z.object({
  // Checkbox: present ("on") when checked
  autoEnabled: z.string().optional().transform((v) => v === "on" || v === "true"),
  keep: z.coerce.number({ error: "กรุณากรอกจำนวน" }).int("ต้องเป็นจำนวนเต็ม").min(1, "อย่างน้อย 1 ไฟล์").max(365, "ไม่เกิน 365 ไฟล์"),
});
export type BackupSettingsInput = z.input<typeof backupSettingsSchema>;
