import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ListChecks, Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { listRuns, openRuns } from "@/modules/pm/queries";
import { bangkokToday, generatePmRuns } from "@/modules/pm/service";
import { PmCalendar } from "./pm-calendar";
import { RunsTable } from "./runs-table";

export const metadata: Metadata = { title: "บำรุงรักษา (PM) | AMS" };

export default async function PmPage({ searchParams }: PageProps<"/pm">) {
  const session = await requirePermission("pm", "view");
  // Lazily catch up on generation (the cron endpoint does the same once a day)
  await generatePmRuns();

  const today = bangkokToday().toISOString().slice(0, 10);
  const { month: monthParam } = await searchParams;
  const month = typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const [monthRuns, open] = await Promise.all([listRuns(new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 0))), openRuns()]);
  const overdue = open.filter((r) => r.status === "OVERDUE").length;
  const role = session.user.role;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={CalendarCheck}
        tone="teal"
        title="บำรุงรักษา (PM)"
        description={`งานค้าง ${open.length} รายการ${overdue ? ` · เลยกำหนด ${overdue}` : ""}`}
        actions={
          <>
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href="/pm/schedules">
                <ListChecks /> แผน PM
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
        <PmCalendar month={month} today={today} runs={monthRuns} />
      </Panel>
      <Panel delay={120}>
        <h2 className="mb-4 font-semibold">งานที่ต้องทำ</h2>
        <RunsTable rows={open} />
      </Panel>
    </div>
  );
}
