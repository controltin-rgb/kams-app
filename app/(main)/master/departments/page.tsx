import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { crudFlags } from "@/lib/permissions-server";
import { requirePermission } from "@/lib/session";
import { listDepartments } from "@/modules/master/queries";
import { DepartmentsTable } from "./departments-table";

export const metadata: Metadata = { title: "แผนก | AMS" };

export default async function DepartmentsPage() {
  const session = await requirePermission("masterData", "view");
  const rows = await listDepartments();

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader icon={Building2} tone="blue" title="แผนก" description="หน่วยงานที่ใช้ระบุผู้ใช้และครุภัณฑ์" />
      <Panel>
        <DepartmentsTable rows={rows} can={crudFlags(session.user.role, "masterData")} />
      </Panel>
    </div>
  );
}
