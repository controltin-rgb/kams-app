import type { Metadata } from "next";
import Link from "next/link";
import { FileUp, Layers, MonitorSmartphone, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { listAssets } from "@/modules/assets/queries";
import { AssetsTable } from "./assets-table";

export const metadata: Metadata = { title: "ทะเบียนครุภัณฑ์ | AMS" };

export default async function AssetsPage() {
  const session = await requirePermission("asset", "view");
  const rows = await listAssets();
  const role = session.user.role;
  const categories = [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b, "th"));

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={MonitorSmartphone}
        tone="orange"
        title="ทะเบียนครุภัณฑ์"
        description={`ทั้งหมด ${rows.length.toLocaleString("th-TH")} รายการ`}
        actions={
          <>
            {can(role, "asset", "import") && (
              <Button asChild variant="outline" className="h-10 rounded-xl">
                <Link href="/assets/import">
                  <FileUp /> นำเข้า
                </Link>
              </Button>
            )}
            {can(role, "asset", "create") && (
              <>
                <Button asChild variant="outline" className="h-10 rounded-xl">
                  <Link href="/assets/bulk">
                    <Layers /> เพิ่มหลายรายการ
                  </Link>
                </Button>
                <Button asChild variant="gradient" className="h-10 rounded-xl px-4">
                  <Link href="/assets/new">
                    <Plus /> ลงทะเบียน
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />
      <Panel>
        <AssetsTable rows={rows} categories={categories} />
      </Panel>
    </div>
  );
}
