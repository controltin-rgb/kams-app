"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, Camera, CameraOff, CheckCircle2, CloudOff, Loader2, RefreshCw, TriangleAlert, Wifi, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AuditResultBadge } from "@/components/audit-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssetCondition } from "@/generated/prisma/enums";
import { assetConditionLabels, auditResultLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import { newUuid, stockTakeDb, type QueuedScan } from "@/modules/audits/offline-db";
import type { ScanPack } from "@/modules/audits/queries";
import { classifyScan, findAsset, parseScannedCode } from "@/modules/audits/scan-logic";
import type { ScanOutcome } from "@/modules/audits/service";
import { CameraScanner } from "./camera-scanner";

const conditions: AssetCondition[] = ["GOOD", "FAIR", "DAMAGED"];
const locationKey = (id: string) => `ams-stocktake-location:${id}`;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Ask the service worker to keep this page and the assets it loaded, so it opens again without a connection. */
async function registerOffline() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const urls = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => u.startsWith(location.origin) && /\/_next\/static\/|\.woff2?$/.test(u));
    reg.active?.postMessage({ type: "CACHE_URLS", urls: [location.pathname, ...urls] });
  } catch {
    // Offline support is best effort; scanning still works while online.
  }
}

export function Scanner({ campaignId }: { campaignId: string }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [pack, setPack] = useState<ScanPack | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState("");
  const [condition, setCondition] = useState<AssetCondition>("GOOD");
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [items, setItems] = useState<QueuedScan[]>([]);
  const [last, setLast] = useState<QueuedScan | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncLock = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const rows = await stockTakeDb().scans.where("campaignId").equals(campaignId).toArray();
    rows.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
    setItems(rows);
  }, [campaignId]);

  const sync = useCallback(async () => {
    if (syncLock.current || !navigator.onLine) return;
    syncLock.current = true;
    setSyncing(true);
    try {
      const db = stockTakeDb();
      for (;;) {
        const pending = await db.scans.where({ campaignId, sync: "pending" }).limit(200).toArray();
        if (!pending.length) break;
        const res = await fetch("/api/audits/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campaignId,
            scans: pending.map((s) => ({ clientUuid: s.clientUuid, code: s.code, actualLocationId: s.actualLocationId, condition: s.condition, notes: s.notes, scannedAt: s.scannedAt })),
          }),
        });
        if (res.status === 401) {
          toast.error("หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่เพื่อซิงก์ (ข้อมูลยังอยู่ในเครื่อง)");
          break;
        }
        if (!res.ok) throw new Error(String(res.status));
        const { results } = (await res.json()) as { results: ScanOutcome[] };
        await db.transaction("rw", db.scans, async () => {
          for (const r of results) {
            await db.scans.update(r.clientUuid, { sync: r.status === "rejected" ? "rejected" : "synced", message: r.message });
          }
        });
        if (results.some((r) => r.status === "rejected")) {
          toast.error(results.find((r) => r.status === "rejected")?.message ?? "บางรายการถูกปฏิเสธ");
          break;
        }
      }
    } catch {
      // Keep the queue; retry on the next interval or when the connection returns.
    } finally {
      syncLock.current = false;
      setSyncing(false);
      await reload();
    }
  }, [campaignId, reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      void registerOffline();
      const db = stockTakeDb();
      const stored = await db.packs.get(campaignId);
      if (cancelled) return;
      if (stored) setPack(stored.pack);
      const saved = localStorage.getItem(locationKey(campaignId));
      if (saved) setLocationId(saved);
      await reload();
      try {
        const res = await fetch(`/api/audits/${campaignId}/pack`);
        if (!res.ok) throw new Error(res.status === 403 ? "ไม่มีสิทธิ์สแกนรอบนี้" : "โหลดข้อมูลไม่สำเร็จ");
        const fresh = (await res.json()) as ScanPack;
        await db.packs.put({ campaignId, pack: fresh, savedAt: fresh.generatedAt });
        if (!cancelled) {
          setPack(fresh);
          setPackError(null);
        }
      } catch (e) {
        if (!cancelled && !stored) setPackError(e instanceof Error && e.message ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      }
      await sync();
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, reload, sync]);

  useEffect(() => {
    const t = setInterval(() => void sync(), 30_000);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", sync);
    };
  }, [sync]);

  const record = useCallback(
    async (raw: string) => {
      const value = parseScannedCode(raw);
      if (!value) return;
      if (!pack) return toast.error("ยังไม่มีข้อมูลครุภัณฑ์ในเครื่อง กรุณาเชื่อมต่ออินเทอร์เน็ตครั้งแรก");
      if (!locationId) return toast.error("กรุณาเลือกสถานที่ที่กำลังตรวจนับก่อน");

      const asset = findAsset(pack.assets, value);
      const key = asset?.assetCode ?? value;
      if (items.some((i) => (i.assetCode ?? i.code) === key && i.actualLocationId === locationId)) {
        toast.warning(`${key} สแกนแล้วในสถานที่นี้ — บันทึกผลล่าสุด`);
      }
      const scan: QueuedScan = {
        clientUuid: newUuid(),
        campaignId,
        code: value,
        actualLocationId: locationId,
        condition,
        notes: notes.trim() || undefined,
        scannedAt: new Date().toISOString(),
        localResult: classifyScan(asset, locationId),
        assetCode: asset?.assetCode,
        assetName: asset?.name,
        sync: "pending",
      };
      await stockTakeDb().scans.put(scan);
      setLast(scan);
      setCondition("GOOD");
      setNotes("");
      await reload();
      void sync();
    },
    [pack, locationId, condition, notes, items, campaignId, reload, sync],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = code;
    setCode("");
    void record(v);
    inputRef.current?.focus();
  };

  const pending = items.filter((i) => i.sync === "pending").length;
  const closed = pack && pack.campaign.status !== "IN_PROGRESS";

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-xl" aria-label="กลับ">
          {/* Full page navigation so the service worker sees (and caches) real documents */}
          <a href={`/audits/${campaignId}`}>
            <ArrowLeft />
          </a>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{pack?.campaign.title ?? "สแกนตรวจนับ"}</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {online ? <Wifi className="size-3.5 text-emerald-600" /> : <CloudOff className="size-3.5 text-amber-600" />}
            {online ? "ออนไลน์" : "ออฟไลน์ — บันทึกไว้ในเครื่อง"}
            {pack && ` · ข้อมูล ณ ${formatDateTime(pack.generatedAt)}`}
          </p>
        </div>
      </div>

      {packError && <p className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">{packError}</p>}
      {closed && <p className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">รอบนี้ไม่ได้เปิดสแกนอยู่ ข้อมูลที่สแกนจะซิงก์ไม่ได้</p>}

      <section className="space-y-3 rounded-[24px] bg-card p-4 shadow-sm shadow-black/4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" id="scan-location-label">
            สถานที่ที่กำลังตรวจนับ
          </label>
          <Select
            value={locationId}
            onValueChange={(v) => {
              setLocationId(v);
              try {
                localStorage.setItem(locationKey(campaignId), v);
              } catch {}
            }}
          >
            <SelectTrigger className="h-11 w-full rounded-xl" aria-labelledby="scan-location-label">
              <SelectValue placeholder="เลือกสถานที่" />
            </SelectTrigger>
            <SelectContent>
              {pack?.locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="สแกนด้วยเครื่องอ่าน หรือพิมพ์รหัส แล้วกด Enter"
            aria-label="รหัสครุภัณฑ์"
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            className="h-12 rounded-xl font-mono text-base"
          />
          <Button type="submit" variant="gradient" className="h-12 rounded-xl px-5" disabled={!code.trim()}>
            บันทึก
          </Button>
        </form>

        <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={() => setCamera((c) => !c)}>
          {camera ? <CameraOff /> : <Camera />} {camera ? "ปิดกล้อง" : "สแกนด้วยกล้อง"}
        </Button>
        {camera && <CameraScanner onCode={(t) => void record(t)} />}

        <div className="space-y-1.5">
          <p className="text-sm font-medium" id="scan-condition-label">
            สภาพ (ใช้กับการสแกนครั้งถัดไป)
          </p>
          <div role="radiogroup" aria-labelledby="scan-condition-label" className="grid grid-cols-3 gap-2">
            {conditions.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={condition === c}
                onClick={() => setCondition(c)}
                className={`h-10 rounded-xl border text-sm font-medium transition-colors ${condition === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
              >
                {assetConditionLabels[c]}
              </button>
            ))}
          </div>
        </div>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="หมายเหตุ (ถ้ามี)" aria-label="หมายเหตุ" maxLength={500} className="h-10 rounded-xl" />
      </section>

      {last && (
        <section
          aria-live="polite"
          className={`animate-pop rounded-[24px] p-4 ${last.localResult === "MATCHED" ? "bg-emerald-500/10" : last.localResult === "UNREGISTERED" ? "bg-violet-500/10" : "bg-amber-500/10"}`}
        >
          <div className="flex items-start gap-3">
            {last.localResult === "MATCHED" ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
            ) : last.localResult === "UNREGISTERED" ? (
              <XCircle className="mt-0.5 size-6 shrink-0 text-violet-600" />
            ) : (
              <TriangleAlert className="mt-0.5 size-6 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0">
              <p className="font-semibold">{auditResultLabels[last.localResult]}</p>
              <p className="font-mono text-sm">{last.assetCode ?? last.code}</p>
              {last.assetName && <p className="truncate text-sm text-muted-foreground">{last.assetName}</p>}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[24px] bg-card p-4 shadow-sm shadow-black/4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm">
            สแกนในเครื่องนี้ <span className="font-semibold">{items.length}</span> รายการ · รอซิงก์ <span className="font-semibold" data-testid="pending-count">{pending}</span>
          </p>
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void sync()} disabled={syncing || !online || pending === 0}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} ซิงก์
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {items.slice(0, 30).map((i) => (
            <li key={i.clientUuid} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium">{i.assetCode ?? i.code}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {i.assetName ?? "-"} · {assetConditionLabels[i.condition]}
                  {i.message && ` · ${i.message}`}
                </p>
              </div>
              <AuditResultBadge result={i.localResult} />
              <span className="w-14 shrink-0 text-right text-xs" title={i.sync}>
                {i.sync === "synced" ? <span className="text-emerald-600">ซิงก์แล้ว</span> : i.sync === "rejected" ? <span className="text-destructive">ถูกปฏิเสธ</span> : <span className="text-amber-600">รอซิงก์</span>}
              </span>
            </li>
          ))}
          {!items.length && <li className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีการสแกน</li>}
        </ul>
      </section>
    </div>
  );
}
