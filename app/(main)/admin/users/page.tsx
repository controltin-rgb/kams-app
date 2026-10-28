import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { listRoles } from "@/lib/roles";
import { requirePermission } from "@/lib/session";
import { listDepartments } from "@/modules/master/queries";
import { listUsers, toUserListItem, userManageFlags } from "@/modules/users/queries";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "ผู้ใช้งาน | AMS" };

export default async function UsersPage() {
  const session = await requirePermission("user", "list");
  const [users, departments, roles] = await Promise.all([listUsers(), listDepartments(), listRoles()]);

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader icon={Users} tone="red" title="จัดการผู้ใช้งาน" description="จัดการบัญชีผู้ใช้ บทบาท และการเข้าถึงระบบ" />
      <Panel>
        <UsersTable
          users={users.map(toUserListItem)}
          departments={departments.map((d) => ({ value: d.id, label: d.name }))}
          roles={roles.map((r) => ({ value: r.key, label: r.name }))}
          can={userManageFlags(session.user.role)}
          currentUserId={session.user.id}
          impersonating={!!session.session.impersonatedBy}
        />
      </Panel>
    </div>
  );
}
