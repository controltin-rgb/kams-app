import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, PackageCheck, Repeat } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { listTransfers } from "@/modules/deployments/queries";
import { TransfersTable } from "./transfers-table";

export const metadata: Metadata = { title: "การถือครอง & Swap | AMS" };

export default async function DeploymentsPage() {
  const session = await requirePermission("deployment", "view");
  const rows = await listTransfers();
  const role = session.user.role;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={ArrowLeftRight}
        tone="green"
        title="การถือครอง & Swap"
        description="เอกสารส่งมอบ คืน ย้ายสถานที่ และเปลี่ยนเครื่อง"
        actions={
          <>
            {can(role, "deployment", "swap") && (
              <Button asChild variant="outline" className="h-10 rounded-xl">
                <Link href="/deployments/swap">
                  <Repeat /> เปลี่ยนเครื่อง
                </Link>
              </Button>
            )}
            {can(role, "deployment", "create") && (
              <Button asChild variant="gradient" className="h-10 rounded-xl px-4">
                <Link href="/deployments/new">
                  <PackageCheck /> ส่งมอบ / คืน / ย้าย
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Panel>
        <TransfersTable rows={rows} />
      </Panel>
    </div>
  );
}
