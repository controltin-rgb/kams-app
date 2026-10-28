import "server-only";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function listUsers() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      banned: true,
      banReason: true,
      phone: true,
      departmentId: true,
      department: { select: { name: true } },
      createdAt: true,
      sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
}

export type UserListItem = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: "active" | "banned";
  banReason: string;
  phone: string;
  departmentId: string;
  department: string;
  createdAt: string;
  lastActiveAt: string | null;
};

export function toUserListItem(u: Awaited<ReturnType<typeof listUsers>>[number]): UserListItem {
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    email: u.email,
    role: u.role,
    status: u.banned ? "banned" : "active",
    banReason: u.banReason ?? "",
    phone: u.phone ?? "",
    departmentId: u.departmentId ?? "",
    department: u.department?.name ?? "",
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: u.sessions[0]?.updatedAt.toISOString() ?? null,
  };
}

/** What the signed-in admin may do on the users page (UX only — actions re-check). */
export function userManageFlags(role: string | null | undefined) {
  return {
    create: can(role, "user", "create"),
    update: can(role, "user", "update"),
    setRole: can(role, "user", "set-role"),
    setPassword: can(role, "user", "set-password"),
    ban: can(role, "user", "ban"),
    delete: can(role, "user", "delete"),
    impersonate: can(role, "user", "impersonate"),
  };
}
export type UserManageFlags = ReturnType<typeof userManageFlags>;
