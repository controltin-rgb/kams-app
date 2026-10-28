import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ListChecks, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { listSchedules } from "@/modules/pm/queries";
import { SchedulesTable } from "./schedules-table";

export const metadata: Metadata = { title: "แผน PM | AMS" };

export default async function SchedulesPage() {
  const session = await requirePermission("pm", "view");
  const rows = await listSchedules();
  const role = session.user.role;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={ListChecks}
        tone="teal"
        title="แผนบำรุงรักษา (PM)"
        description={`ทั้งหมด ${rows.length} แผน`}
        actions={
          <>
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/pm">
                <CalendarCheck /> ปฏิทิน
              </Link>
            </Button>
            {can(role, "pm", "create") && (
              <Button asChild variant="gradient" className="h-10 rounded-xl px-4">
                <Link href="/pm/schedules/new">
                  <Plus /> สร้างแผน PM
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Panel>
        <SchedulesTable rows={rows} can={{ update: can(role, "pm", "update"), delete: can(role, "pm", "delete") }} />
      </Panel>
    </div>
  );
}
