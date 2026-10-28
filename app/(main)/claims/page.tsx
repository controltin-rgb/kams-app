import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { listClaims } from "@/modules/claims/queries";
import { ClaimsTable } from "./claims-table";

export const metadata: Metadata = { title: "ส่งเคลม | AMS" };

export default async function ClaimsPage() {
  const session = await requirePermission("claim", "view");
  const rows = await listClaims();
  const open = rows.filter((c) => c.status === "SENT" || c.status === "IN_REPAIR").length;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={Wrench}
        tone="blue"
        title="ส่งเคลม / ส่งซ่อมภายนอก"
        description={`อยู่ระหว่างเคลม ${open} รายการ`}
        actions={
          can(session.user.role, "claim", "create") && (
            <Button asChild variant="gradient" className="h-10 rounded-xl px-4">
              <Link href="/claims/new">
                <Plus /> ส่งเคลม
              </Link>
            </Button>
          )
        }
      />
      <Panel>
        <ClaimsTable rows={rows} />
      </Panel>
    </div>
  );
}
