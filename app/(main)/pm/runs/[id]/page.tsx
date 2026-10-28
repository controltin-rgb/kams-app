import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Check, ClipboardList, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PmRunStatusBadge } from "@/components/pm-badges";
import { can } from "@/lib/permissions";
import { pmFrequencyLabels } from "@/lib/labels";
import { requirePermission } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { getRun } from "@/modules/pm/queries";
import { RunChecklist } from "./run-checklist";

export const metadata: Metadata = { title: "งาน PM | AMS" };

function Card({ icon: Icon, title, children }: { icon: typeof ClipboardList; title: string; children: ReactNode }) {
  return (
    <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function RunPage({ params }: PageProps<"/pm/runs/[id]">) {
  const session = await requirePermission("pm", "view");
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  const closed = run.status === "DONE" || run.status === "SKIPPED";
  const s = run.schedule;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={CalendarCheck}
        tone="teal"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.title} <PmRunStatusBadge status={run.status} />
          </span>
        }
        description={`กำหนด ${formatDate(run.dueDate)} · ${pmFrequencyLabels[s.frequency]}`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card icon={ClipboardList} title="รายการตรวจเช็ก">
            {closed ? (
              run.status === "SKIPPED" ? (
                <p className="rounded-xl bg-muted/50 p-3 text-sm">ข้ามงานรอบนี้: {run.notes}</p>
              ) : (
                <div className="space-y-3">
                  <ol className="divide-y divide-border rounded-2xl border border-border">
                    {run.results.map((r, n) => (
                      <li key={r.itemId} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-6 text-sm text-muted-foreground">{n + 1}.</span>
                        <span className="flex-1">{r.label}</span>
                        {r.type === "CHECK" ? (
                          r.pass ? (
                            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check className="size-4" /> ผ่าน
                            </span>
                          ) : r.pass === false ? (
                            <span className="flex items-center gap-1 text-sm font-semibold text-destructive">
                              <X className="size-4" /> ไม่ผ่าน
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )
                        ) : (
                          <span className="font-medium">
                            {r.value || "-"} {r.unit}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                  {run.notes && <p className="rounded-xl bg-muted/50 p-3 text-sm">หมายเหตุ: {run.notes}</p>}
                </div>
              )
            ) : (
              <RunChecklist runId={run.id} status={run.status} items={s.checklist} canExecute={can(session.user.role, "pm", "execute")} />
            )}
          </Card>
        </div>
        <Card icon={CalendarCheck} title="ข้อมูลงาน">
          <dl className="space-y-2.5 text-sm">
            {(
              [
                [
                  "ครุภัณฑ์",
                  s.asset && (
                    <Link href={`/assets/${s.asset.id}`} className="text-primary hover:underline">
                      {s.asset.assetCode}
                    </Link>
                  ),
                ],
                ["สถานที่", s.location],
                ["ผู้รับผิดชอบ", s.assignedTech],
                ["เริ่มทำ", run.startedAt && formatDateTime(run.startedAt)],
                ["บันทึกผล", run.doneAt && formatDateTime(run.doneAt)],
                ["ผู้บันทึก", run.doneBy],
              ] as [string, ReactNode][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value || "-"}</dd>
              </div>
            ))}
          </dl>
          {s.description && <p className="mt-4 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm">{s.description}</p>}
        </Card>
      </div>
    </div>
  );
}
