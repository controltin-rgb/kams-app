import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listRoles } from "@/lib/roles";
import { requirePermission } from "@/lib/session";
import { RolesTable } from "./roles-table";

export const metadata: Metadata = { title: "จัดการสิทธิ์การใช้งาน | AMS" };

export default async function RolesPage() {
  const session = await requirePermission("role", "view");
  const [roles, users] = await Promise.all([listRoles(), prisma.user.findMany({ where: { deletedAt: null }, select: { role: true } })]);
  const userCount = (key: string) => users.filter((u) => u.role.split(",").map((r) => r.trim()).includes(key)).length;
  const role = session.user.role;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader icon={ShieldCheck} tone="red" title="จัดการสิทธิ์การใช้งาน" description="บทบาทและสิทธิ์ของแต่ละบทบาท มีผลทันทีกับผู้ใช้ทุกคนในบทบาทนั้น" />
      <Panel>
        <RolesTable
          rows={roles.map((r) => ({
            key: r.key,
            name: r.name,
            description: r.description,
            kind: r.key === "admin" ? "locked" : r.builtIn ? (r.customized ? "customized" : "builtIn") : "custom",
            users: userCount(r.key),
            permissions: Object.values(r.permissions).reduce((n, a) => n + (a?.length ?? 0), 0),
          }))}
          copyOptions={roles.filter((r) => r.key !== "admin").map((r) => ({ value: r.key, label: r.name }))}
          can={{ create: can(role, "role", "create"), delete: can(role, "role", "delete") }}
        />
      </Panel>
    </div>
  );
}
