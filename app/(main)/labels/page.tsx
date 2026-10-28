import type { Metadata } from "next";
import Link from "next/link";
import { Printer, ScanBarcode } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { crudFlags } from "@/lib/permissions-server";
import { requirePermission } from "@/lib/session";
import { listTemplates } from "@/modules/labels/queries";
import { TemplatesTable } from "./templates-table";

export const metadata: Metadata = { title: "จัดการฉลาก | AMS" };

export default async function LabelsPage() {
  const session = await requirePermission("label", "view");
  const rows = await listTemplates();

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={ScanBarcode}
        tone="orange"
        title="จัดการฉลาก"
        description="แม่แบบฉลากครุภัณฑ์และฉลากสถานะ ออกแบบด้วยการลากวาง"
        actions={
          <Button asChild variant="gradient" className="h-10 rounded-xl px-4">
            <Link href="/labels/print">
              <Printer /> พิมพ์ฉลาก
            </Link>
          </Button>
        }
      />
      <Panel>
        <TemplatesTable rows={rows} can={crudFlags(session.user.role, "label")} />
      </Panel>
    </div>
  );
}
