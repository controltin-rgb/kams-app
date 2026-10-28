import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { LOG_ROW_LIMIT, listLogs, logRange } from "@/modules/logs/queries";
import { ClearLogDialog } from "./clear-log-dialog";
import { LogsTable } from "./logs-table";

export const metadata: Metadata = { title: "Audit Log | AMS" };

export default async function AuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const session = await requirePermission("log", "view");
  const sp = await searchParams;
  const range = logRange(typeof sp.from === "string" ? sp.from : undefined, typeof sp.to === "string" ? sp.to : undefined);
  const { rows, truncated } = await listLogs(range);
  const role = session.user.role;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={ScrollText}
        tone="violet"
        title="Audit Log"
        description="บันทึกการใช้งานระบบทั้งหมด (เพิ่มได้อย่างเดียว แก้ไขไม่ได้)"
        actions={can(role, "log", "clear") && <ClearLogDialog impersonating={!!session.session.impersonatedBy} />}
      />
      <Panel>
        <form className="mb-4 flex flex-wrap items-end gap-3" aria-label="ช่วงวันที่">
          <label className="space-y-1 text-sm">
            <span className="font-medium">ตั้งแต่วันที่</span>
            <Input type="date" name="from" defaultValue={range.from} className="h-10 rounded-xl" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">ถึงวันที่</span>
            <Input type="date" name="to" defaultValue={range.to} className="h-10 rounded-xl" />
          </label>
          <Button type="submit" variant="outline" className="h-10 rounded-xl">
            แสดง
          </Button>
          <p className="text-sm text-muted-foreground">
            {rows.length.toLocaleString("th-TH")} รายการ{truncated && ` (แสดง ${LOG_ROW_LIMIT.toLocaleString("th-TH")} รายการล่าสุด — กรุณาเลือกช่วงวันที่ให้แคบลง)`}
          </p>
        </form>
        <LogsTable rows={rows} exportable={can(role, "log", "export")} />
      </Panel>
    </div>
  );
}
