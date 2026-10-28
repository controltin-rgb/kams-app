import type { Metadata } from "next";
import { Shapes } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { can } from "@/lib/permissions";
import { crudFlags } from "@/lib/permissions-server";
import { requirePermission } from "@/lib/session";
import { listCategories } from "@/modules/master/queries";
import { CategoriesTable } from "./categories-table";

export const metadata: Metadata = { title: "ประเภทครุภัณฑ์ | AMS" };

export default async function CategoriesPage() {
  const session = await requirePermission("masterData", "view");
  const rows = await listCategories();

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={Shapes}
        tone="violet"
        title="ประเภทครุภัณฑ์"
        description="รหัสนำหน้าใช้สร้างรหัสครุภัณฑ์ และ property ใช้สร้างฟอร์มตามประเภทอัตโนมัติ"
      />
      <Panel>
        <CategoriesTable rows={rows} can={crudFlags(session.user.role, "masterData")} sceneModels={can(session.user.role, "office3d", "configureLayout")} />
      </Panel>
    </div>
  );
}
