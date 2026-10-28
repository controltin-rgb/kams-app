"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { ADMIN_ROLE, type Action } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { listRoles } from "@/lib/roles";
import { requirePermission } from "@/lib/session";
import {
  banUserSchema,
  createUserSchema,
  setPasswordSchema,
  updateUserSchema,
  type BanUserInput,
  type CreateUserInput,
  type SetPasswordInput,
  type UpdateUserInput,
} from "./schemas";

async function actor(action: Action<"user">) {
  const session = await requirePermission("user", action);
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy, isAdmin: isAdminRole(session.user.role) };
}

function isAdminRole(role: string | null | undefined) {
  return !!role && role.split(",").some((r) => r.trim() === ADMIN_ROLE);
}

/** Admin accounts (and the admin role) can only be managed by admins, even if user:* is granted to other roles. */
const ADMIN_ONLY = "เฉพาะผู้ดูแลระบบที่จัดการบัญชีหรือบทบาทผู้ดูแลระบบได้";

async function roleExists(role: string) {
  return (await listRoles()).some((r) => r.key === role);
}

function uniqueErrors<T extends { username?: unknown; email?: unknown }>(e: unknown): FormState<T> | null {
  if (isUniqueViolation(e, "username")) return { fieldErrors: { username: ["Username นี้ถูกใช้แล้ว"] } as FormState<T>["fieldErrors"] };
  if (isUniqueViolation(e, "email")) return { fieldErrors: { email: ["อีเมลนี้ถูกใช้แล้ว"] } as FormState<T>["fieldErrors"] };
  return null;
}

async function validDepartment(id?: string) {
  return !id || !!(await prisma.department.findUnique({ where: { id }, select: { id: true } }));
}

/** Target user that may be managed (exists and not soft-deleted). */
async function findManaged(id: string) {
  return prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, username: true, role: true, banned: true } });
}

export async function createUser(_prev: FormState<CreateUserInput>, formData: FormData): Promise<FormState<CreateUserInput>> {
  const who = await actor("create");
  const parsed = createUserSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  if (!(await roleExists(d.role))) return { fieldErrors: { role: ["ไม่พบบทบาทนี้"] } };
  if (isAdminRole(d.role) && !who.isAdmin) return { fieldErrors: { role: [ADMIN_ONLY] } };
  if (!(await validDepartment(d.departmentId))) return { fieldErrors: { departmentId: ["ไม่พบแผนก"] } };

  try {
    const id = randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id,
          name: d.name,
          email: d.email,
          emailVerified: true,
          username: d.username,
          displayUsername: d.username,
          role: d.role,
          departmentId: d.departmentId ?? null,
          phone: d.phone ?? null,
          accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(d.password) } },
        },
      });
      await logAction({ ...who, action: "CREATE", module: "user", entityId: id, details: { username: d.username, role: d.role } }, tx);
    });
  } catch (e) {
    const u = uniqueErrors<CreateUserInput>(e);
    if (u) return u;
    throw e;
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "เพิ่มผู้ใช้แล้ว" };
}

export async function updateUser(_prev: FormState<UpdateUserInput>, formData: FormData): Promise<FormState<UpdateUserInput>> {
  const who = await actor("update");
  const parsed = updateUserSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const current = await prisma.user.findFirst({ where: { id: d.id, deletedAt: null } });
  if (!current) return { message: "ไม่พบผู้ใช้" };
  if (isAdminRole(current.role) && !who.isAdmin) return { message: ADMIN_ONLY };
  if (current.role !== d.role) {
    await actor("set-role");
    if (d.id === who.userId) return { fieldErrors: { role: ["เปลี่ยนบทบาทของตนเองไม่ได้"] } };
    if (!(await roleExists(d.role))) return { fieldErrors: { role: ["ไม่พบบทบาทนี้"] } };
    if (isAdminRole(d.role) && !who.isAdmin) return { fieldErrors: { role: [ADMIN_ONLY] } };
  }
  if (!(await validDepartment(d.departmentId))) return { fieldErrors: { departmentId: ["ไม่พบแผนก"] } };

  const changes: Record<string, { from: string | null; to: string | null }> = {};
  const next = { name: d.name, username: d.username, email: d.email, role: d.role, departmentId: d.departmentId ?? null, phone: d.phone ?? null };
  for (const [k, v] of Object.entries(next)) {
    const before = current[k as keyof typeof next];
    if (before !== v) changes[k] = { from: before, to: v };
  }
  if (!Object.keys(changes).length) return { ok: true, message: "ไม่มีการเปลี่ยนแปลง" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: d.id }, data: { ...next, displayUsername: d.username } });
      // A new role must take effect now, not when the session expires
      if (changes.role) await tx.session.deleteMany({ where: { userId: d.id } });
      await logAction({ ...who, action: changes.role ? "SET_ROLE" : "UPDATE", module: "user", entityId: d.id, details: { username: d.username, changes } }, tx);
    });
  } catch (e) {
    const u = uniqueErrors<UpdateUserInput>(e);
    if (u) return u;
    throw e;
  }
  revalidatePath("/admin/users");
  return { ok: true, message: "บันทึกข้อมูลผู้ใช้แล้ว" };
}

/** Admin password reset: replaces the credential password and signs the user out everywhere. */
export async function setUserPassword(_prev: FormState<SetPasswordInput>, formData: FormData): Promise<FormState<SetPasswordInput>> {
  const who = await actor("set-password");
  const parsed = setPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  const user = await findManaged(d.id);
  if (!user) return { message: "ไม่พบผู้ใช้" };
  if (isAdminRole(user.role) && !who.isAdmin) return { message: ADMIN_ONLY };

  const hash = await hashPassword(d.password);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.account.updateMany({ where: { userId: d.id, providerId: "credential" }, data: { password: hash } });
    if (!updated.count) await tx.account.create({ data: { id: randomUUID(), accountId: d.id, userId: d.id, providerId: "credential", password: hash } });
    if (d.id !== who.userId) await tx.session.deleteMany({ where: { userId: d.id } });
    await logAction({ ...who, action: "SET_PASSWORD", module: "user", entityId: d.id, details: { username: user.username } }, tx);
  });
  return { ok: true, message: "ตั้งรหัสผ่านใหม่แล้ว" };
}

export async function banUser(_prev: FormState<BanUserInput>, formData: FormData): Promise<FormState<BanUserInput>> {
  const who = await actor("ban");
  const parsed = banUserSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  if (d.id === who.userId) return { message: "ระงับบัญชีของตนเองไม่ได้" };
  const user = await findManaged(d.id);
  if (!user) return { message: "ไม่พบผู้ใช้" };
  if (isAdminRole(user.role) && !who.isAdmin) return { message: ADMIN_ONLY };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: d.id }, data: { banned: true, banReason: d.reason ?? null, banExpires: null } });
    await tx.session.deleteMany({ where: { userId: d.id } });
    await logAction({ ...who, action: "BAN", module: "user", entityId: d.id, details: { username: user.username, reason: d.reason ?? null } }, tx);
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "ระงับการใช้งานแล้ว" };
}

export async function unbanUser(id: string): Promise<FormState> {
  const who = await actor("ban");
  const user = await findManaged(id);
  if (!user) return { message: "ไม่พบผู้ใช้" };
  if (isAdminRole(user.role) && !who.isAdmin) return { message: ADMIN_ONLY };
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { banned: false, banReason: null, banExpires: null } });
    await logAction({ ...who, action: "UNBAN", module: "user", entityId: id, details: { username: user.username } }, tx);
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "เปิดใช้งานแล้ว" };
}

/** Soft delete (CLAUDE.md §3): the row stays for history references; the account can no longer sign in. */
export async function deleteUser(id: string): Promise<FormState> {
  const who = await actor("delete");
  if (id === who.userId) return { message: "ลบบัญชีของตนเองไม่ได้" };
  const user = await findManaged(id);
  if (!user) return { message: "ไม่พบผู้ใช้" };
  if (isAdminRole(user.role) && !who.isAdmin) return { message: ADMIN_ONLY };
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { deletedAt: new Date(), banned: true, banReason: "ลบผู้ใช้" } });
    await tx.session.deleteMany({ where: { userId: id } });
    await logAction({ ...who, action: "DELETE", module: "user", entityId: id, details: { username: user.username } }, tx);
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "ลบผู้ใช้แล้ว" };
}

export async function revokeSessions(id: string): Promise<FormState> {
  const who = await actor("ban");
  const user = await findManaged(id);
  if (!user) return { message: "ไม่พบผู้ใช้" };
  if (isAdminRole(user.role) && !who.isAdmin) return { message: ADMIN_ONLY };
  if (id === who.userId) return { message: "ใช้เมนูออกจากระบบสำหรับบัญชีของตนเอง" };
  const { count } = await prisma.session.deleteMany({ where: { userId: id } });
  await logAction({ ...who, action: "REVOKE_SESSIONS", module: "user", entityId: id, details: { username: user.username, count } });
  return { ok: true, message: `ออกจากระบบทุกอุปกรณ์แล้ว (${count} เซสชัน)` };
}
