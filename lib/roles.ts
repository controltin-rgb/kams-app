import "server-only";
import { cache } from "react";
import { roleLabels } from "@/lib/labels";
import { ADMIN_ROLE, builtInRoles, defaultPermissions, isRoleName, permissionsOf, sanitizePermissions, setRolePermissions, type PermissionMap } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** Load edited roles once per request and make `can()` use them. Called from getSession(). */
export const loadRoles = cache(async () => {
  const rows = await prisma.role.findMany({ orderBy: { createdAt: "asc" } });
  setRolePermissions(Object.fromEntries(rows.filter((r) => r.key !== ADMIN_ROLE).map((r) => [r.key, sanitizePermissions(r.permissions)])));
  return rows;
});

export type RoleInfo = {
  key: string;
  name: string;
  description: string;
  permissions: PermissionMap;
  builtIn: boolean;
  /** Built-in role whose permissions were changed in the UI */
  customized: boolean;
  editable: boolean;
};

const builtInDescriptions: Record<string, string> = {
  admin: "ทุกสิทธิ์ รวม Impersonate, Backup/Restore, ล้าง Log (แก้ไขไม่ได้)",
  manager: "ดูทุกอย่าง มอบหมายงานซ่อม อนุมัติผลตรวจนับ ดูรายงาน",
  technician: "งานซ่อมที่ได้รับมอบหมาย PM เปลี่ยนเครื่อง ส่งเคลม",
  helpdesk: "รับแจ้งซ่อม มอบหมายงานให้ช่าง ติดตามงานซ่อมทั้งหมด",
  auditor: "สแกนตรวจนับ (เห็นเฉพาะรอบที่ได้รับมอบหมาย)",
  user: "แจ้งซ่อม ดูครุภัณฑ์และงานซ่อมของตน",
};

/** Built-in roles (with any edits applied) followed by custom roles. */
export async function listRoles(): Promise<RoleInfo[]> {
  const rows = await loadRoles();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const builtIn = builtInRoles.map((key): RoleInfo => {
    const row = byKey.get(key);
    return {
      key,
      name: row?.name ?? roleLabels[key] ?? key,
      description: row?.description ?? builtInDescriptions[key] ?? "",
      permissions: key === ADMIN_ROLE ? permissionsOf(key) : row ? sanitizePermissions(row.permissions) : defaultPermissions[key],
      builtIn: true,
      customized: !!row && key !== ADMIN_ROLE,
      editable: key !== ADMIN_ROLE,
    };
  });
  const custom = rows
    .filter((r) => !isRoleName(r.key))
    .map((r): RoleInfo => ({ key: r.key, name: r.name, description: r.description ?? "", permissions: sanitizePermissions(r.permissions), builtIn: false, customized: false, editable: true }));
  return [...builtIn, ...custom];
}

/** key → display name, for role badges across the app. */
export async function roleNames(): Promise<Record<string, string>> {
  return Object.fromEntries((await listRoles()).map((r) => [r.key, r.name]));
}

export function roleLabel(role: string, names: Record<string, string>) {
  return role
    .split(",")
    .map((r) => names[r.trim()] ?? r.trim())
    .join(", ");
}
