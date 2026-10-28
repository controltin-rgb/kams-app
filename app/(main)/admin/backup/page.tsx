import type { Metadata } from "next";
import { Cloud, TriangleAlert } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { checkTools, databaseName, listBackups } from "@/modules/backup/service";
import { BackupSettingsForm, BackupsTable, RunBackupButton } from "./backup-ui";

export const metadata: Metadata = { title: "Backup / Restore | AMS" };

export default async function BackupPage() {
  const session = await requirePermission("backup", "view");
  const [backups, settings, tools] = await Promise.all([listBackups(), getSettings(), checkTools()]);
  const role = session.user.role;
  const impersonating = !!session.session.impersonatedBy;
  const canRun = can(role, "backup", "run") && !impersonating && tools.ok;
  const canRestore = can(role, "backup", "restore") && !impersonating && tools.ok;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={Cloud}
        tone="green"
        title="Backup / Restore"
        description={`ฐานข้อมูล ${databaseName()} · ${tools.ok ? tools.version : "ไม่พร้อมใช้งาน"}`}
        actions={canRun && <RunBackupButton />}
      />
      {impersonating && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert className="size-4 shrink-0" /> ใช้งาน Backup/Restore ไม่ได้ขณะเข้าใช้งานแทนผู้อื่น
        </p>
      )}
      {!tools.ok && (
        <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
          {tools.error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <BackupsTable rows={backups} canRun={canRun} canRestore={canRestore} database={databaseName()} />
        </Panel>
        <Panel delay={120}>
          <h2 className="mb-4 font-semibold">สำรองข้อมูลอัตโนมัติ</h2>
          <BackupSettingsForm autoEnabled={settings["backup.autoEnabled"]} keep={settings["backup.keep"]} disabled={!canRun} />
          <div className="mt-5 space-y-2 text-xs text-muted-foreground">
            <p>ตั้ง Task Scheduler / cron ให้เรียกวันละครั้ง (เรียกซ้ำภายใน 20 ชั่วโมงจะถูกข้าม):</p>
            <code className="block break-all rounded-lg bg-muted p-2">curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; https://&lt;host&gt;/api/cron/backup</code>
            <p>ไฟล์เก็บใน storage/backups นอกโฟลเดอร์ public ดาวน์โหลดได้เฉพาะผู้ดูแลระบบ ควรคัดลอกไฟล์ไปเก็บนอกเครื่องเซิร์ฟเวอร์เป็นระยะ</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
