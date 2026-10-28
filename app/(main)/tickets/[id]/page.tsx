import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Headset, History, Paperclip, Printer, Settings2, Store, Wrench } from "lucide-react";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { SlaBadge, TicketPriorityBadge, TicketStatusBadge } from "@/components/ticket-badges";
import { Button } from "@/components/ui/button";
import type { TicketStatus } from "@/generated/prisma/enums";
import { ticketCategoryLabels, ticketPriorityLabels, ticketSourceLabels, ticketStatusLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { formatDateTime } from "@/lib/utils/date";
import { getTicket, listAssignableTechs, type TicketDetail } from "@/modules/tickets/queries";
import { AssignForm, AttachmentsPanel, CommentBox, InternalBadge, PartsPanel, PriorityForm, RepairInfoForm, StatusActions } from "./ticket-panels";

export const metadata: Metadata = { title: "งานแจ้งซ่อม | AMS" };

function Card({ icon: Icon, title, children, delay = 0, action }: { icon: typeof Headset; title: string; children: ReactNode; delay?: number; action?: ReactNode }) {
  return (
    <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" />
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Human-readable line for each timeline entry */
async function describeActivities(ticket: TicketDetail) {
  const userIds = new Set<string>();
  for (const a of ticket.activities) {
    if (a.kind === "ASSIGNED") {
      for (const v of [a.fromValue, a.toValue]) {
        const id = (v as { userId?: string | null } | null)?.userId;
        if (id) userIds.add(id);
      }
    }
  }
  const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  const get = (v: unknown, key: string) => (v as Record<string, string | null> | null)?.[key] ?? null;

  return ticket.activities.map((a) => {
    let title: string;
    switch (a.kind) {
      case "CREATED":
        title = "แจ้งซ่อม";
        break;
      case "COMMENT":
        title = "ความเห็น";
        break;
      case "STATUS_CHANGED":
        title = `${ticketStatusLabels[get(a.fromValue, "status") as TicketStatus] ?? "-"} → ${ticketStatusLabels[get(a.toValue, "status") as TicketStatus] ?? "-"}`;
        break;
      case "ASSIGNED": {
        const to = get(a.toValue, "userId");
        title = to ? `มอบหมายให้ ${name.get(to) ?? "-"}` : "ยกเลิกการมอบหมาย";
        break;
      }
      case "PRIORITY_CHANGED":
        title = `ความเร่งด่วน: ${ticketPriorityLabels[get(a.fromValue, "priority") as keyof typeof ticketPriorityLabels] ?? "-"} → ${ticketPriorityLabels[get(a.toValue, "priority") as keyof typeof ticketPriorityLabels] ?? "-"}`;
        break;
      case "PART_ADDED":
        title = "เพิ่มอะไหล่";
        break;
      case "PART_REMOVED":
        title = "ลบอะไหล่";
        break;
      case "ATTACHMENT_ADDED":
        title = "แนบไฟล์";
        break;
      case "ATTACHMENT_REMOVED":
        title = "ลบไฟล์";
        break;
      default:
        title = "อัปเดต";
    }
    return { id: a.id, kind: a.kind, title, body: a.body, internal: a.internal, actor: a.actorName, at: a.createdAt };
  });
}

export default async function TicketDetailPage({ params }: PageProps<"/tickets/[id]">) {
  const session = await requirePermission("ticket", "view");
  const { id } = await params;
  const ticket = await getTicket(id, { id: session.user.id, role: session.user.role });
  if (!ticket) notFound();

  const { abilities } = ticket;
  const [activities, techs] = await Promise.all([describeActivities(ticket), abilities.assign ? listAssignableTechs() : Promise.resolve([])]);
  const reporter = ticket.reporter?.name ?? ticket.reporterName ?? "-";
  const contact = ticket.reporter ? [ticket.reporter.phone, ticket.reporter.email].filter(Boolean).join(" · ") : ticket.reporterContact;

  const info: [string, ReactNode][] = [
    ["สถานะ", <TicketStatusBadge key="s" status={ticket.status} />],
    ["ความเร่งด่วน", <TicketPriorityBadge key="p" priority={ticket.priority} />],
    ["หมวด", ticketCategoryLabels[ticket.category]],
    ["ช่องทาง", ticketSourceLabels[ticket.source]],
    ["ผู้แจ้ง", reporter],
    ["ติดต่อ", contact || "-"],
    ["ผู้รับผิดชอบ", ticket.assignedTech?.name ?? "ยังไม่มอบหมาย"],
    [
      "กำหนดเสร็จ (SLA)",
      <span key="d" className="flex flex-wrap items-center gap-1.5">
        {formatDateTime(ticket.dueAt)} <SlaBadge state={ticket.sla} />
      </span>,
    ],
    ["แจ้งเมื่อ", formatDateTime(ticket.createdAt)],
    ["ตอบรับครั้งแรก", formatDateTime(ticket.firstResponseAt)],
    ["แก้ไขเสร็จ", formatDateTime(ticket.resolvedAt)],
    ["ปิดงาน", formatDateTime(ticket.closedAt)],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={Headset}
        tone="pink"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{ticket.ticketNumber}</span>
            <TicketStatusBadge status={ticket.status} />
          </span>
        }
        description={ticket.title}
        actions={
          <>
            {ticket.asset && abilities.work && can(session.user.role, "claim", "create") && (
              <Button asChild variant="outline" className="h-10 rounded-xl">
                <Link href={`/claims/new?ticket=${ticket.id}`}>
                  <Store /> ส่งเคลม
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href={`/print/tickets/${ticket.id}`} target="_blank">
                <Printer /> ใบแจ้งซ่อม
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card icon={ClipboardList} title="รายละเอียด" delay={60}>
            <p className="whitespace-pre-line">{ticket.description || <span className="text-muted-foreground">ไม่มีรายละเอียด</span>}</p>
            {ticket.locationText && <p className="mt-3 text-sm text-muted-foreground">สถานที่: {ticket.locationText}</p>}
            {ticket.asset && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
                <Link href={`/assets/${ticket.asset.id}`} className="font-mono font-semibold text-primary hover:underline">
                  {ticket.asset.assetCode}
                </Link>
                <span>{ticket.asset.name}</span>
                <AssetStatusBadge status={ticket.asset.status} />
                {ticket.assetUnusable && <span className="text-xs text-muted-foreground">(แจ้งว่าใช้งานไม่ได้)</span>}
              </div>
            )}
          </Card>

          {(abilities.internalNotes || ticket.parts.length > 0 || Number(ticket.repairCost) > 0) && (
            <Card icon={Wrench} title="อะไหล่และค่าใช้จ่าย" delay={100}>
              <PartsPanel ticketId={ticket.id} parts={ticket.parts} laborCost={ticket.laborCost} repairCost={ticket.repairCost} canEdit={abilities.work} />
            </Card>
          )}

          <Card icon={Paperclip} title={`ไฟล์แนบ (${ticket.attachments.length})`} delay={140}>
            <AttachmentsPanel
              ticketId={ticket.id}
              attachments={ticket.attachments}
              canAttach={abilities.attach}
              canManage={abilities.work}
              userId={session.user.id}
            />
          </Card>

          <Card icon={History} title="ไทม์ไลน์" delay={180}>
            <ol className="relative space-y-4 border-l border-border pl-5">
              {activities.map((a) => (
                <li key={a.id} className="relative">
                  <span
                    className={`absolute -left-[26.5px] top-1.5 size-3 rounded-full border-2 border-card ${a.kind === "COMMENT" ? "bg-pink-500" : "bg-primary"}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.title}</span>
                    {a.internal && <InternalBadge />}
                  </div>
                  {a.body && (
                    <p
                      className={`mt-1 whitespace-pre-line text-sm ${a.kind === "COMMENT" ? "rounded-xl bg-muted/50 p-3" : "text-foreground/80"}`}
                    >
                      {a.body}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(a.at)}
                    {a.actor && ` · ${a.actor}`}
                  </p>
                </li>
              ))}
            </ol>
            {abilities.comment && (
              <div className="mt-6 border-t border-border pt-5">
                <CommentBox ticketId={ticket.id} canInternal={abilities.internalNotes} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card icon={Settings2} title="ดำเนินการ" delay={80}>
            <div className="space-y-5">
              <StatusActions ticketId={ticket.id} current={ticket.status} next={abilities.nextStatuses} resolution={ticket.resolution} />
              {abilities.assign && <AssignForm ticketId={ticket.id} current={ticket.assignedTechId} techs={techs} />}
              {abilities.work && <PriorityForm ticketId={ticket.id} current={ticket.priority} />}
            </div>
          </Card>

          <Card icon={ClipboardList} title="ข้อมูลงาน" delay={120}>
            <dl className="space-y-2.5 text-sm">
              {info.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {abilities.work ? (
            <Card icon={Wrench} title="บันทึกการซ่อม" delay={160}>
              <RepairInfoForm ticketId={ticket.id} cause={ticket.cause} resolution={ticket.resolution} laborCost={ticket.laborCost} />
            </Card>
          ) : (
            (ticket.cause || ticket.resolution) && (
              <Card icon={Wrench} title="ผลการซ่อม" delay={160}>
                {ticket.cause && <p className="text-sm"><b>สาเหตุ:</b> {ticket.cause}</p>}
                {ticket.resolution && <p className="mt-2 text-sm"><b>วิธีแก้ไข:</b> {ticket.resolution}</p>}
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
