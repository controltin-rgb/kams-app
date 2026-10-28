import { z } from "zod";
const password = z.string({ error: "กรุณากรอกรหัสผ่าน" }).min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกินไป");

const base = {
  name: z.string({ error: "กรุณากรอกชื่อ" }).trim().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อยาวเกิน 100 ตัวอักษร"),
  username: z
    .string({ error: "กรุณากรอก Username" })
    .trim()
    .toLowerCase()
    .min(3, "Username ต้องมีอย่างน้อย 3 ตัวอักษร")
    .max(30, "Username ยาวเกิน 30 ตัวอักษร")
    .regex(/^[a-z0-9._]+$/, "ใช้ได้เฉพาะ a-z, 0-9, จุด และขีดล่าง"),
  email: z.email({ error: "รูปแบบอีเมลไม่ถูกต้อง" }).trim().toLowerCase(),
  // Roles are editable (Role table); the action checks that the key exists
  role: z.string({ error: "กรุณาเลือกบทบาท" }).trim().min(1, "กรุณาเลือกบทบาท").max(30),
  departmentId: z.string().optional(),
  phone: z.string().trim().max(30).optional(),
};

export const createUserSchema = z.object({ ...base, password });
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({ id: z.string().min(1), ...base });
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const setPasswordSchema = z
  .object({ id: z.string().min(1), password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "รหัสผ่านไม่ตรงกัน" });
export type SetPasswordInput = z.input<typeof setPasswordSchema>;

export const banUserSchema = z.object({ id: z.string().min(1), reason: z.string().trim().max(300).optional() });
export type BanUserInput = z.input<typeof banUserSchema>;
