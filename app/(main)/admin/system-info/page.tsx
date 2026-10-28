import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Database, HardDrive, Info, Server } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils/date";
import { systemInfo } from "@/modules/system/queries";
import { SystemNotesDialog } from "./system-notes-dialog";

export const metadata: Metadata = { title: "ข้อมูลระบบ | AMS" };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const num = (n: number) => n.toLocaleString("th-TH");

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d && `${d} วัน`, h && `${h} ชม.`, `${m} นาที`].filter(Boolean).join(" ");
}

function Card({ icon: Icon, title, rows }: { icon: typeof Info; title: string; rows: [string, ReactNode][] }) {
  return (
    <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      <dl className="space-y-2.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-all text-right font-medium">{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Notes({ title, text }: { title: string; text: string }) {
  return (
    <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {text ? <div className="whitespace-pre-line text-sm leading-relaxed">{text}</div> : <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>}
    </section>
  );
}

export default async function SystemInfoPage() {
  const session = await requirePermission("system", "view");
  const [info, settings] = await Promise.all([systemInfo(), getSettings()]);
  const { app, runtime, database, counts, storage, backups } = info;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={Info}
        tone="orange"
        title="ข้อมูลระบบ"
        description={`${app.name} เวอร์ชัน ${app.version}`}
        actions={can(session.user.role, "system", "editInfo") && <SystemNotesDialog releaseNotes={settings["system.releaseNotes"]} roadmap={settings["system.roadmap"]} />}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card
          icon={Server}
          title="แอปพลิเคชันและเซิร์ฟเวอร์"
          rows={[
            ["เวอร์ชันระบบ", app.version],
            ["Next.js", app.next],
            ["Prisma", app.prisma],
            ["Node.js", runtime.node],
            ["โหมด", runtime.env],
            ["ระบบปฏิบัติการ", runtime.platform],
            ["เครื่อง", runtime.hostname],
            ["เขตเวลาเซิร์ฟเวอร์", runtime.timezone],
            ["ทำงานต่อเนื่อง", uptime(runtime.uptimeSeconds)],
            ["หน่วยความจำ", `${num(runtime.memoryMb)} MB`],
          ]}
        />
        <Card
          icon={Database}
          title="ฐานข้อมูล"
          rows={[
            ["ชื่อฐานข้อมูล", database.name],
            ["เวอร์ชัน", database.version],
            ["ขนาด", mb(database.sizeBytes)],
            ["Migration ล่าสุด", <span key="m" className="font-mono text-xs">{database.lastMigration}</span>],
            ["ครุภัณฑ์", num(counts.assets)],
            ["งานแจ้งซ่อม", num(counts.tickets)],
            ["ผู้ใช้งาน", num(counts.users)],
            ["งาน PM", num(counts.pmRuns)],
            ["รายการเคลม", num(counts.claims)],
            ["รอบตรวจนับ", num(counts.campaigns)],
            ["Audit Log", num(counts.logs)],
          ]}
        />
        <Card
          icon={HardDrive}
          title="พื้นที่จัดเก็บไฟล์"
          rows={[
            ["ไฟล์แนบ/ลายเซ็น/รูป", `${num(storage.files)} ไฟล์ (${num(counts.attachments)} ในฐานข้อมูล)`],
            ["ขนาดรวม", mb(storage.bytes)],
            ["ไฟล์สำรองข้อมูล", `${num(backups.count)} ไฟล์ (${mb(backups.totalBytes)})`],
            ["สำรองล่าสุด", backups.latest ? formatDateTime(backups.latest.createdAt) : "ยังไม่เคยสำรอง"],
            ["ตำแหน่ง", <span key="p" className="font-mono text-xs">{storage.path}</span>],
          ]}
        />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Notes title="บันทึกการเปลี่ยนแปลง (Release notes)" text={settings["system.releaseNotes"]} />
        <Notes title="แผนการพัฒนา (Roadmap)" text={settings["system.roadmap"]} />
      </div>
    </div>
  );
}
