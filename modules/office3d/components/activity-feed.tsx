"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { assetStatusLabels, auditResultLabels, sceneEventLabels } from "@/lib/labels";
import { formatTime } from "@/lib/utils/date";
import type { SceneEventMessage } from "../events";
import { assetStatusColors, auditResultColors, priorityColors } from "../scene";
import { SPEEDS, useOfficeStore, type StreamStatus } from "../store";

const streamText: Record<StreamStatus, string> = { connecting: "กำลังเชื่อมต่อ", live: "สด", offline: "ขาดการเชื่อมต่อ" };
const streamDot: Record<StreamStatus, string> = { connecting: "bg-amber-400", live: "bg-emerald-500", offline: "bg-red-500" };

function FeedItem({ e }: { e: SceneEventMessage }) {
  if (e.type === "ASSET_STATUS_CHANGED") {
    return (
      <li className="flex gap-2">
        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: assetStatusColors[e.asset.status] }} />
        <div className="min-w-0">
          <p className="font-medium">{sceneEventLabels[e.type]}</p>
          <p className="truncate text-muted-foreground">
            {assetStatusLabels[e.asset.status]} · {formatTime(e.at)}
          </p>
        </div>
      </li>
    );
  }
  if ("pm" in e || "audit" in e) {
    const color = "audit" in e ? auditResultColors[e.audit.result] : e.type === "PM_DONE" ? assetStatusColors.ACTIVE : assetStatusColors.SPARE;
    const detail = "audit" in e ? auditResultLabels[e.audit.result] : (e.pm.title ?? "");
    return (
      <li className="flex gap-2">
        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <div className="min-w-0">
          <p className="font-medium">{sceneEventLabels[e.type]}</p>
          <p className="truncate text-muted-foreground">
            {detail ? `${detail} · ` : ""}
            {formatTime(e.at)}
          </p>
        </div>
      </li>
    );
  }
  if ("move" in e) {
    return (
      <li className="flex gap-2">
        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: e.type.startsWith("CLAIM") ? assetStatusColors.CLAIMING : assetStatusColors.SPARE }} />
        <div className="min-w-0">
          <p className="font-medium">
            {sceneEventLabels[e.type]} {e.move.docNumber && <span className="font-mono text-muted-foreground">{e.move.docNumber}</span>}
          </p>
          <p className="truncate text-muted-foreground">{formatTime(e.at)}</p>
        </div>
      </li>
    );
  }
  const t = e.ticket;
  const head = (
    <>
      {sceneEventLabels[e.type]} <span className="font-mono text-muted-foreground">{t.ticketNumber}</span>
    </>
  );
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: priorityColors[t.priority] }} />
      <div className="min-w-0">
        {t.canView ? (
          <Link href={`/tickets/${t.ticketId}`} className="font-medium hover:underline">
            {head}
          </Link>
        ) : (
          <p className="font-medium">{head}</p>
        )}
        <p className="truncate text-muted-foreground">
          {t.title ? `${t.title} · ` : ""}
          {formatTime(e.at)}
        </p>
      </div>
    </li>
  );
}

/** Live events as they arrive (newest first). */
export function ActivityFeed() {
  const feed = useOfficeStore((s) => s.feed);
  const stream = useOfficeStore((s) => s.stream);
  return (
    <section aria-label="กิจกรรมล่าสุด" className="absolute left-3 top-3 hidden w-72 rounded-2xl bg-card/90 text-xs shadow-sm backdrop-blur md:block">
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <h2 className="font-semibold">กิจกรรมล่าสุด</h2>
        <span className="flex items-center gap-1.5 text-muted-foreground" data-testid="office-stream">
          <span className={`size-2 rounded-full ${streamDot[stream]} ${stream === "live" ? "animate-pulse" : ""}`} />
          {streamText[stream]}
        </span>
      </div>
      {feed.length ? (
        <ul className="max-h-56 space-y-2 overflow-y-auto px-4 pb-3 pt-2">
          {feed.map((e) => (
            <FeedItem key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-3 pt-2 text-muted-foreground">ยังไม่มีเหตุการณ์ใหม่ตั้งแต่เปิดหน้านี้</p>
      )}
    </section>
  );
}

/** Pause / speed of the scenes, and how many are waiting to play. */
export function PlaybackControls() {
  const paused = useOfficeStore((s) => s.paused);
  const speed = useOfficeStore((s) => s.speed);
  const waiting = useOfficeStore((s) => s.waiting);
  const running = useOfficeStore((s) => s.running);
  const { togglePaused, setSpeed } = useOfficeStore.getState();
  return (
    <div className="flex items-center gap-1 rounded-full bg-card p-1 text-sm font-semibold shadow-sm">
      {running > 0 && (
        <span className="px-2 text-xs font-medium text-muted-foreground" data-testid="office-running">
          กำลังเล่น {running}
        </span>
      )}
      {waiting > 0 && (
        <span className="px-2 text-xs font-medium text-muted-foreground" data-testid="office-waiting">
          รอเล่น {waiting}
        </span>
      )}
      <button type="button" onClick={togglePaused} aria-label={paused ? "เล่นต่อ" : "หยุดชั่วคราว"} aria-pressed={paused} className="rounded-full p-2 transition hover:bg-muted">
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setSpeed(s)}
          aria-label={`ความเร็ว ${s} เท่า`}
          aria-pressed={speed === s}
          className={`rounded-full px-2.5 py-1.5 text-xs transition ${speed === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}
