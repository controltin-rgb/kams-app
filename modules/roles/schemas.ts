import { z } from "zod";

export const roleSchema = z.object({
  // Present when editing; the key itself never changes (it is stored on every user)
  key: z
    .string({ error: "กรุณากรอกรหัสบทบาท" })
    .trim()
    .toLowerCase()
    .min(2, "อย่างน้อย 2 ตัวอักษร")
    .max(30, "ไม่เกิน 30 ตัวอักษร")
    .regex(/^[a-z][a-z0-9_-]*$/, "ใช้ a-z, 0-9, - และ _ (ขึ้นต้นด้วยตัวอักษร)"),
  name: z.string({ error: "กรุณากรอกชื่อบทบาท" }).trim().min(1, "กรุณากรอกชื่อบทบาท").max(60, "ไม่เกิน 60 ตัวอักษร"),
  description: z.string().trim().max(300, "ไม่เกิน 300 ตัวอักษร").optional(),
  copyFrom: z.string().optional(),
});
export type RoleInput = z.input<typeof roleSchema>;
