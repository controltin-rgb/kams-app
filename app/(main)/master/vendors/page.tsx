import type { Metadata } from "next";
import { Store } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { crudFlags } from "@/lib/permissions-server";
import { requirePermission } from "@/lib/session";
import { listVendors } from "@/modules/master/queries";
import { VendorsTable } from "./vendors-table";

export const metadata: Metadata = { title: "ผู้ขาย/ผู้ให้บริการ | AMS" };

export default async function VendorsPage() {
  const session = await requirePermission("masterData", "view");
  const rows = await listVendors();

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader icon={Store} tone="green" title="ผู้ขาย/ผู้ให้บริการ" description="บริษัทที่ซื้อครุภัณฑ์หรือส่งซ่อม/ส่งเคลม" />
      <Panel>
        <VendorsTable rows={rows} can={crudFlags(session.user.role, "masterData")} />
      </Panel>
    </div>
  );
}
