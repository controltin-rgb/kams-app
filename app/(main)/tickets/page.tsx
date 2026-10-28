import type { Metadata } from "next";
import Link from "next/link";
import { Headset, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { listTickets } from "@/modules/tickets/queries";
import { TicketsTable } from "./tickets-table";

export const metadata: Metadata = { title: "งานแจ้งซ่อม | AMS" };

export default async function TicketsPage() {
  const session = await requirePermission("ticket", "view");
  const rows = await listTickets({ id: session.user.id, role: session.user.role });
  const open = rows.filter((t) => !["CLOSED", "CANCELLED"].includes(t.status)).length;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={Headset}
        tone="pink"
        title="งานแจ้งซ่อม"
        description={`งานที่ยังไม่ปิด ${open} รายการ`}
        actions={
          can(session.user.role, "ticket", "create") && (
            <Button asChild variant="gradient" className="h-10 rounded-xl px-4">
              <Link href="/tickets/new">
                <Plus /> แจ้งซ่อม
              </Link>
            </Button>
          )
        }
      />
      <Panel>
        <TicketsTable rows={rows} />
      </Panel>
    </div>
  );
}
