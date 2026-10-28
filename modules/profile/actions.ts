"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type FormState,
  type UpdateProfileInput,
} from "./schemas";

export async function updateProfile(
  _prev: FormState<UpdateProfileInput>,
  formData: FormData,
): Promise<FormState<UpdateProfileInput>> {
  const session = await requireSession();
  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { name, email, lineUserId } = parsed.data;
  const current = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { lineUserId: true } });
  const before = { name: session.user.name, email: session.user.email, lineUserId: current.lineUserId };
  if (before.name === name && before.email === email && before.lineUserId === lineUserId) return { ok: true, message: "ไม่มีข้อมูลที่เปลี่ยนแปลง" };

  if (email !== before.email) {
    const taken = await prisma.user.findFirst({ where: { email, NOT: { id: session.user.id } }, select: { id: true } });
    if (taken) return { fieldErrors: { email: ["อีเมลนี้ถูกใช้งานแล้ว"] } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { name, email, lineUserId } });
    await logAction(
      {
        action: "UPDATE_PROFILE",
        module: "profile",
        userId: session.user.id,
        impersonatedBy: session.session.impersonatedBy,
        entityId: session.user.id,
        details: { before, after: { name, email, lineUserId } },
      },
      tx,
    );
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "บันทึกข้อมูลเรียบร้อยแล้ว" };
}

export async function changePassword(
  _prev: FormState<ChangePasswordInput>,
  formData: FormData,
): Promise<FormState<ChangePasswordInput>> {
  const session = await requireSession();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });
  } catch (e) {
    if (isAPIError(e) && e.body?.code === "INVALID_PASSWORD") {
      return { fieldErrors: { currentPassword: ["รหัสผ่านปัจจุบันไม่ถูกต้อง"] } };
    }
    if (isAPIError(e)) return { message: "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่" };
    throw e;
  }

  await logAction({
    action: "CHANGE_PASSWORD",
    module: "profile",
    userId: session.user.id,
    impersonatedBy: session.session.impersonatedBy,
    entityId: session.user.id,
  });
  return { ok: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว อุปกรณ์อื่นถูกออกจากระบบแล้ว" };
}
