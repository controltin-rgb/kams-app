"use server";

import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requireOwnSession } from "@/lib/session";
import { queueNotify } from "@/modules/notifications/service";
import { getSettings, setSetting } from "@/lib/settings";
import { backupSettingsSchema, restoreSchema, type BackupSettingsInput, type RestoreInput } from "./schemas";
import { createBackup, databaseName, deleteBackupFile, isBackupName, listBackups, pruneBackups, restoreBackup } from "./service";

const IMPERSONATING = "ใช้งาน Backup/Restore ไม่ได้ขณะเข้าใช้งานแทนผู้อื่น";

// One backup/restore at a time per server process
let busy = false;
async function exclusive<T>(fn: () => Promise<T>): Promise<T | null> {
  if (busy) return null;
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

const sizeText = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

export async function runBackup(): Promise<FormState> {
  const session = await requireOwnSession("backup", "run");
  if (!session) return { message: IMPERSONATING };
  try {
    const result = await exclusive(async () => {
      const file = await createBackup("manual");
      const pruned = await pruneBackups((await getSettings())["backup.keep"], file.name);
      await logAction({ userId: session.user.id, action: "BACKUP", module: "backup", entityId: file.name, details: { size: file.size, pruned } });
      return file;
    });
    if (!result) return { message: "มีการสำรองหรือกู้คืนข้อมูลกำลังทำงานอยู่" };
    revalidatePath("/admin/backup");
    return { ok: true, message: `สำรองข้อมูลแล้ว (${sizeText(result.size)})` };
  } catch (e) {
    await logAction({ userId: session.user.id, action: "BACKUP_FAILED", module: "backup", details: { error: (e as Error).message } });
    queueNotify({ event: "BACKUP_FAILED", title: "สำรองข้อมูลล้มเหลว", body: (e as Error).message, href: "/admin/backup", actorId: session.user.id });
    return { message: (e as Error).message };
  }
}

/**
 * Replace the database with a backup. A pre-restore backup is taken first so the restore itself can be undone.
 * The confirmation is the database name typed by the admin.
 */
export async function restoreFromBackup(_prev: FormState<RestoreInput>, formData: FormData): Promise<FormState<RestoreInput>> {
  const session = await requireOwnSession("backup", "restore");
  if (!session) return { message: IMPERSONATING };
  const parsed = restoreSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { name, confirm } = parsed.data;
  if (confirm !== databaseName()) return { fieldErrors: { confirm: [`พิมพ์ชื่อฐานข้อมูล "${databaseName()}" ให้ถูกต้อง`] } };
  if (!(await listBackups()).some((b) => b.name === name)) return { message: "ไม่พบไฟล์สำรองข้อมูล" };

  const who = { id: session.user.id, name: session.user.name };
  try {
    const result = await exclusive(async () => {
      const safety = await createBackup("prerestore");
      await logAction({ userId: who.id, action: "BACKUP", module: "backup", entityId: safety.name, details: { reason: "ก่อนกู้คืน", restoring: name } });
      await restoreBackup(name);
      // The audit table now holds the backup's rows; record the restore in it. The user row may not exist in the backup.
      const exists = await prisma.user.findUnique({ where: { id: who.id }, select: { id: true } });
      await logAction({ userId: exists ? who.id : null, action: "RESTORE", module: "backup", entityId: name, details: { by: who.name, safetyBackup: safety.name } });
      return safety;
    });
    if (!result) return { message: "มีการสำรองหรือกู้คืนข้อมูลกำลังทำงานอยู่" };
  } catch (e) {
    await logAction({ userId: who.id, action: "RESTORE_FAILED", module: "backup", entityId: name, details: { error: (e as Error).message } });
    return { message: (e as Error).message };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "กู้คืนข้อมูลแล้ว" };
}

export async function deleteBackup(name: string): Promise<FormState> {
  const session = await requireOwnSession("backup", "run");
  if (!session) return { message: IMPERSONATING };
  if (!isBackupName(name) || !(await listBackups()).some((b) => b.name === name)) return { message: "ไม่พบไฟล์สำรองข้อมูล" };
  await deleteBackupFile(name);
  await logAction({ userId: session.user.id, action: "DELETE", module: "backup", entityId: name });
  revalidatePath("/admin/backup");
  return { ok: true, message: "ลบไฟล์สำรองข้อมูลแล้ว" };
}

export async function saveBackupSettings(_prev: FormState<BackupSettingsInput>, formData: FormData): Promise<FormState<BackupSettingsInput>> {
  const session = await requireOwnSession("backup", "run");
  if (!session) return { message: IMPERSONATING };
  const parsed = backupSettingsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  await prisma.$transaction(async (tx) => {
    await setSetting(tx, "backup.autoEnabled", d.autoEnabled);
    await setSetting(tx, "backup.keep", d.keep);
    await logAction({ userId: session.user.id, action: "UPDATE_SETTINGS", module: "backup", details: d }, tx);
  });
  revalidatePath("/admin/backup");
  return { ok: true, message: "บันทึกการตั้งค่าแล้ว" };
}
