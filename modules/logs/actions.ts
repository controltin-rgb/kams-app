"use server";

import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requireOwnSession } from "@/lib/session";
import { clearLogSchema, type ClearLogInput } from "./schemas";

/**
 * The only way log rows are ever removed (CLAUDE.md §9). Needs a typed confirmation, is refused while
 * impersonating, and always leaves a new LOG_CLEAR entry behind.
 */
export async function clearLogs(_prev: FormState<ClearLogInput>, formData: FormData): Promise<FormState<ClearLogInput>> {
  const session = await requireOwnSession("log", "clear");
  if (!session) return { message: "ล้าง Log ไม่ได้ขณะเข้าใช้งานแทนผู้อื่น" };
  const parsed = clearLogSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const days = Number(parsed.data.olderThanDays);
  const before = days ? new Date(Date.now() - days * 86_400_000) : new Date();
  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.systemAuditLog.deleteMany({ where: { createdAt: { lt: before } } });
    await logAction({ userId: session.user.id, action: "LOG_CLEAR", module: "log", details: { olderThanDays: days, before: before.toISOString(), deleted: count } }, tx);
    return count;
  });

  revalidatePath("/admin/audit-logs");
  return { ok: true, message: `ล้าง Log แล้ว ${count.toLocaleString("th-TH")} รายการ` };
}
