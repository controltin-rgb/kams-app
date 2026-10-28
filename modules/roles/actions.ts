"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { logAction } from "@/lib/audit";
import { fieldErrors, formDataToObject, type FormState } from "@/lib/form-state";
import { ADMIN_ROLE, assignable, isRoleName, permissionsOf, sanitizePermissions, type PermissionMap, type Resource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listRoles } from "@/lib/roles";
import { requirePermission } from "@/lib/session";
import { roleSchema, type RoleInput } from "./schemas";

async function actor(action: "create" | "update" | "delete") {
  const session = await requirePermission("role", action);
  const roles = (session.user.role ?? "").split(",").map((r) => r.trim());
  return { userId: session.user.id, impersonatedBy: session.session.impersonatedBy, roles, isAdmin: roles.includes(ADMIN_ROLE) };
}
type Actor = Awaited<ReturnType<typeof actor>>;

/** Actions in `wanted` that the actor does not hold themselves (non-admins may only hand out what they have). */
function beyondActor(who: Actor, wanted: PermissionMap) {
  if (who.isAdmin) return [];
  const missing: string[] = [];
  for (const [res, acts] of Object.entries(wanted) as [Resource, string[]][]) {
    const own = new Set(who.roles.flatMap((r) => permissionsOf(r)[res] ?? []));
    for (const a of acts) if (!own.has(a)) missing.push(`${res}:${a}`);
  }
  return missing;
}

function revalidate(key?: string) {
  revalidatePath("/admin/roles");
  if (key) revalidatePath(`/admin/roles/${key}`);
  // Menus everywhere depend on permissions
  revalidatePath("/", "layout");
}

export async function createRole(_prev: FormState<RoleInput>, formData: FormData): Promise<FormState<RoleInput>> {
  const who = await actor("create");
  const parsed = roleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const all = await listRoles();
  if (all.some((r) => r.key === d.key)) return { fieldErrors: { key: ["รหัสบทบาทนี้ถูกใช้แล้ว"] } };
  const source = d.copyFrom ? all.find((r) => r.key === d.copyFrom) : undefined;
  const permissions = source && source.key !== ADMIN_ROLE ? source.permissions : {};
  if (beyondActor(who, permissions).length) return { fieldErrors: { copyFrom: ["คัดลอกบทบาทที่มีสิทธิ์มากกว่าของคุณไม่ได้"] } };

  await prisma.$transaction(async (tx) => {
    await tx.role.create({ data: { key: d.key, name: d.name, description: d.description ?? null, permissions: permissions as Prisma.InputJsonValue } });
    await logAction({ ...who, action: "CREATE", module: "role", entityId: d.key, details: { name: d.name, copyFrom: source?.key ?? null } }, tx);
  });
  revalidate();
  return { ok: true, message: "สร้างบทบาทแล้ว", data: { id: d.key } };
}

/**
 * Save name/description and the permission matrix. Checkbox names: `perm.<resource>.<action>`.
 * Guards: admin is fixed; non-admins cannot edit roles they hold or grant actions they do not have.
 */
export async function updateRole(_prev: FormState<RoleInput>, formData: FormData): Promise<FormState<RoleInput>> {
  const who = await actor("update");
  const parsed = roleSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;

  const current = (await listRoles()).find((r) => r.key === d.key);
  if (!current) return { message: "ไม่พบบทบาท" };
  if (!current.editable) return { message: "บทบาทผู้ดูแลระบบมีทุกสิทธิ์เสมอ แก้ไขไม่ได้" };
  if (!who.isAdmin && who.roles.includes(d.key)) return { message: "แก้ไขบทบาทของตนเองไม่ได้" };

  const raw: Record<string, string[]> = {};
  for (const [res, actions] of Object.entries(assignable)) {
    const picked = actions.filter((a) => formData.get(`perm.${res}.${a}`) === "true");
    if (picked.length) raw[res] = picked;
  }
  const permissions = sanitizePermissions(raw);
  const missing = beyondActor(who, permissions);
  if (missing.length) return { message: `ให้สิทธิ์ที่คุณไม่มีไม่ได้: ${missing.join(", ")}` };

  const data = { name: d.name, description: d.description ?? null, permissions: permissions as Prisma.InputJsonValue };
  await prisma.$transaction(async (tx) => {
    await tx.role.upsert({ where: { key: d.key }, create: { key: d.key, ...data }, update: data });
    await logAction({ ...who, action: "UPDATE", module: "role", entityId: d.key, details: { name: d.name, before: current.permissions, after: permissions } as Prisma.InputJsonValue }, tx);
  });
  revalidate(d.key);
  return { ok: true, message: "บันทึกสิทธิ์แล้ว" };
}

/** Built-in role: drop the edits and go back to the code defaults. */
export async function resetRole(key: string): Promise<FormState> {
  const who = await actor("update");
  if (!isRoleName(key) || key === ADMIN_ROLE) return { message: "คืนค่าได้เฉพาะบทบาทเริ่มต้นของระบบ" };
  if (!who.isAdmin && who.roles.includes(key)) return { message: "แก้ไขบทบาทของตนเองไม่ได้" };
  const { count } = await prisma.role.deleteMany({ where: { key } });
  if (!count) return { ok: true, message: "บทบาทนี้ใช้ค่าเริ่มต้นอยู่แล้ว" };
  await logAction({ ...who, action: "RESET", module: "role", entityId: key });
  revalidate(key);
  return { ok: true, message: "คืนค่าเริ่มต้นแล้ว" };
}

export async function deleteRole(key: string): Promise<FormState> {
  const who = await actor("delete");
  if (isRoleName(key)) return { message: "บทบาทเริ่มต้นของระบบลบไม่ได้" };
  const role = await prisma.role.findUnique({ where: { key } });
  if (!role) return { message: "ไม่พบบทบาท" };
  const users = await prisma.user.findMany({ where: { deletedAt: null }, select: { role: true } });
  const inUse = users.filter((u) => u.role.split(",").map((r) => r.trim()).includes(key)).length;
  if (inUse) return { message: `ยังมีผู้ใช้ ${inUse} คนในบทบาทนี้ ย้ายผู้ใช้ไปบทบาทอื่นก่อน` };
  await prisma.$transaction(async (tx) => {
    await tx.role.delete({ where: { key } });
    await logAction({ ...who, action: "DELETE", module: "role", entityId: key, details: { name: role.name } }, tx);
  });
  revalidate();
  return { ok: true, message: "ลบบทบาทแล้ว" };
}
