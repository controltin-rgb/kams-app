import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { listCampaigns } from "@/modules/audits/queries";
import { CampaignsTable } from "./campaigns-table";

export const metadata: Metadata = { title: "ตรวจนับครุภัณฑ์ | AMS" };

export default async function AuditsPage() {
  const session = await requirePermission("audit", "view");
  const rows = await listCampaigns({ id: session.user.id, role: session.user.role });
  const active = rows.filter((c) => c.status === "IN_PROGRESS").length;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        tone="violet"
        title="ตรวจนับครุภัณฑ์"
        description={`กำลังตรวจนับ ${active} รอบ`}
        actions={
          can(session.user.role, "audit", "create") && (
            <Button asChild variant="gradient" className="h-10 rounded-xl px-4">
              <Link href="/audits/new">
                <Plus /> สร้างรอบตรวจนับ
              </Link>
            </Button>
          )
        }
      />
      <Panel>
        <CampaignsTable rows={rows} />
      </Panel>
    </div>
  );
}
