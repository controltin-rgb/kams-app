"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Video, VideoOff, X } from "lucide-react";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/ticket-badges";
import { office3dMarkerLabels, roleLabels } from "@/lib/labels";
import type { OfficeSnapshot, SceneTicket } from "../scene";
import type { Hit } from "./hit";

/** Short text for the hover tooltip */
export function describeHit(hit: Hit, snap: OfficeSnapshot): { title: string; sub?: string } {
  if (hit.kind === "agent") {
    const a = snap.agents.find((x) => x.id === hit.agentId);
    return { title: a?.name ?? "", sub: a ? roleText(a.role) : undefined };
  }
  if (hit.kind === "marker") {
    const m = snap.markers.find((x) => x.id === hit.markerId);
    if (!m) return { title: "" };
    return { title: `${office3dMarkerLabels[m.reason]} ${m.ticketIds.length} งาน` };
  }
  const a = hit.assetId ? snap.assets.find((x) => x.id === hit.assetId) : null;
  if (!a) return { title: "ครุภัณฑ์ (ยังไม่ผูกข้อมูล)", sub: hit.model };
  return { title: a.name ?? "ครุภัณฑ์", sub: a.assetCode ?? undefined };
}

const roleText = (role: string) =>
  role
    .split(",")
    .map((r) => roleLabels[r.trim()] ?? r.trim())
    .join(", ");

function TicketList({ tickets, empty }: { tickets: SceneTicket[]; empty: string }) {
  if (!tickets.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {tickets.map((t) => (
        <li key={t.id} className="rounded-xl bg-muted/60 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{t.ticketNumber}</span>
            <TicketPriorityBadge priority={t.priority} />
          </div>
          {t.canView ? (
            <Link href={`/tickets/${t.id}`} className="mt-1 block font-medium hover:underline">
              {t.title}
            </Link>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">งานแจ้งซ่อมของผู้อื่น</p>
          )}
          {t.onHoldReason && <p className="mt-1 text-xs text-muted-foreground">พักงาน: {t.onHoldReason}</p>}
          <div className="mt-2 flex items-center gap-2">
            <TicketStatusBadge status={t.status} />
            {t.overdue && <span className="text-xs font-semibold text-red-600 dark:text-red-400">เกินกำหนด</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Side panel for the selected person / asset / marker, linking to the real Ticket and Asset pages. */
export function DetailPanel({
  hit,
  snap,
  onClose,
  following = false,
  onFollow,
}: {
  hit: Hit;
  snap: OfficeSnapshot;
  onClose: () => void;
  /** The camera follows this person */
  following?: boolean;
  onFollow?: (agentId: string) => void;
}) {
  let title = "";
  let body: ReactNode = null;

  if (hit.kind === "agent") {
    const a = snap.agents.find((x) => x.id === hit.agentId);
    title = a?.name ?? "";
    const reported = snap.tickets.filter((t) => a?.userId && t.reporterId === a.userId);
    const assigned = snap.tickets.filter((t) => a?.userId && t.assignedTechId === a.userId);
    body = (
      <>
        <p className="text-sm text-muted-foreground">{a ? roleText(a.role) : ""}</p>
        {onFollow && (
          <button
            type="button"
            onClick={() => onFollow(hit.agentId)}
            aria-pressed={following}
            className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold transition hover:bg-muted/70"
          >
            {following ? <VideoOff className="size-4" /> : <Video className="size-4" />} {following ? "เลิกติดตาม" : "ติดตามด้วยกล้อง"}
          </button>
        )}
        {!a?.userId && <p className="text-sm text-muted-foreground">ตัวละครประกอบฉาก (ยังไม่มีผู้ใช้ในบทบาทนี้)</p>}
        {a?.userId && (
          <>
            <h3 className="font-semibold">งานที่แจ้ง</h3>
            <TicketList tickets={reported} empty="ไม่มีงานแจ้งซ่อมค้าง" />
            {assigned.length > 0 && (
              <>
                <h3 className="font-semibold">งานที่รับผิดชอบ</h3>
                <TicketList tickets={assigned} empty="" />
              </>
            )}
          </>
        )}
      </>
    );
  } else if (hit.kind === "marker") {
    const m = snap.markers.find((x) => x.id === hit.markerId);
    title = m ? office3dMarkerLabels[m.reason] : "";
    body = <TicketList tickets={snap.tickets.filter((t) => m?.ticketIds.includes(t.id))} empty="ไม่มีงาน" />;
  } else {
    const a = hit.assetId ? snap.assets.find((x) => x.id === hit.assetId) : null;
    title = a?.name ?? "ครุภัณฑ์";
    body = a ? (
      <>
        <div className="flex flex-wrap items-center gap-2">
          {a.assetCode && <span className="font-mono text-sm">{a.assetCode}</span>}
          <AssetStatusBadge status={a.status} />
        </div>
        {a.assetCode && (
          <Link href={`/assets/${a.id}`} className="inline-block rounded-full bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/70">
            เปิดหน้าครุภัณฑ์
          </Link>
        )}
        <h3 className="font-semibold">งานแจ้งซ่อม</h3>
        <TicketList tickets={snap.tickets.filter((t) => t.assetId === a.id)} empty="ไม่มีงานแจ้งซ่อมค้าง" />
      </>
    ) : (
      <p className="text-sm text-muted-foreground">ตำแหน่งนี้ยังไม่ได้ผูกกับสถานที่ในระบบ (ตั้งค่าได้ที่ ข้อมูลหลัก → สถานที่)</p>
    );
  }

  return (
    <aside className="absolute inset-y-3 right-3 flex w-80 max-w-[calc(100%-1.5rem)] animate-fade-up flex-col rounded-2xl bg-card shadow-lg" aria-label="รายละเอียด">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="truncate font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-muted" aria-label="ปิด">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{body}</div>
    </aside>
  );
}
