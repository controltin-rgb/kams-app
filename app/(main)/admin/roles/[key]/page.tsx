import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { assignable, can } from "@/lib/permissions";
import { listRoles } from "@/lib/roles";
import { requirePermission } from "@/lib/session";
import { RoleForm } from "./role-form";

export const metadata: Metadata = { title: "สิทธิ์การใช้งาน | AMS" };

export default async function RolePage({ params }: PageProps<"/admin/roles/[key]">) {
  const session = await requirePermission("role", "view");
  const { key } = await params;
  const role = (await listRoles()).find((r) => r.key === key);
  if (!role) notFound();

  const own = (session.user.role ?? "").split(",").map((r) => r.trim());
  const isAdmin = own.includes("admin");
  // Read-only: admin role, no update permission, or a non-admin looking at a role they hold
  const lockedReason = !role.editable
    ? "บทบาทผู้ดูแลระบบมีทุกสิทธิ์เสมอ (รวม Impersonate) แก้ไขไม่ได้ เพื่อป้องกันการล็อกตัวเองออกจากระบบ"
    : !can(session.user.role, "role", "update")
      ? "คุณดูได้อย่างเดียว"
      : !isAdmin && own.includes(role.key)
        ? "แก้ไขบทบาทของตนเองไม่ได้"
        : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={ShieldCheck}
        tone="red"
        title={role.name}
        description={`รหัส ${role.key}${role.builtIn ? " · บทบาทเริ่มต้นของระบบ" : ""}`}
      />
      <RoleForm
        role={{ key: role.key, name: role.name, description: role.description, permissions: role.permissions, builtIn: role.builtIn, customized: role.customized }}
        matrix={Object.entries(assignable).map(([resource, actions]) => ({ resource, actions }))}
        lockedReason={lockedReason}
        canReset={!lockedReason && role.customized}
      />
    </div>
  );
}
