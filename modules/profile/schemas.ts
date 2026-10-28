import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อยาวเกิน 100 ตัวอักษร"),
  email: z.email("รูปแบบอีเมลไม่ถูกต้อง").trim().toLowerCase(),
  // LINE Messaging API user id: "U" + 32 hex characters (empty = no LINE notifications)
  lineUserId: z
    .string()
    .trim()
    .regex(/^(U[0-9a-f]{32})?$/, "LINE User ID ต้องขึ้นต้นด้วย U ตามด้วยตัวอักษร 32 ตัว")
    .optional()
    .transform((v) => v || null),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z.string().min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร").max(128, "รหัสผ่านยาวเกินไป"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "รหัสผ่านใหม่ไม่ตรงกัน",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Shared result shape for form server actions (used with useActionState). */
export type FormState<T> = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Partial<Record<keyof T, string[]>>;
};
