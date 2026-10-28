"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { LabelView, type RenderContext } from "@/components/labels/label-view";
import { MultiSelect } from "@/components/forms/multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLabelData, logLabelPrint } from "@/modules/labels/actions";
import { paginate, slotPositions, type LabelData } from "@/modules/labels/design";
import type { PrintTemplate } from "@/modules/labels/queries";

type Option = { value: string; label: string };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-6">
      <h2 className="flex items-center gap-2.5 font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PrintLabels({
  templates,
  assets,
  orgName,
  defaultAssetIds,
  defaultTemplateId,
}: {
  templates: PrintTemplate[];
  assets: Option[];
  orgName: string;
  defaultAssetIds: string[];
  defaultTemplateId?: string;
}) {
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? templates.find((t) => t.kind === "ASSET" && t.isDefault)?.id ?? templates[0]?.id ?? "");
  const [assetIds, setAssetIds] = useState<string[]>(defaultAssetIds);
  const [copies, setCopies] = useState(1);
  const [quantity, setQuantity] = useState(40);
  const [startAt, setStartAt] = useState(1);
  const [data, setData] = useState<(LabelData & { id: string })[] | null>(null);
  const [loading, startLoading] = useTransition();

  const template = templates.find((t) => t.id === templateId);
  const perSheet = template ? template.layout.columns * template.layout.rows : 1;
  const ctx: RenderContext = useMemo(() => ({ orgName, now: new Date(), origin: typeof window === "undefined" ? "" : window.location.origin }), [orgName]);

  const labels: (LabelData | null)[] = useMemo(() => {
    if (!template) return [];
    if (template.kind === "STATUS") return Array.from({ length: Math.min(Math.max(quantity, 1), 1000) }, () => null);
    return (data ?? []).flatMap((d) => Array.from({ length: copies }, () => d));
  }, [template, quantity, data, copies]);

  const sheets = useMemo(() => (template ? paginate(labels, perSheet, startAt) : []), [labels, perSheet, startAt, template]);
  const slots = template ? slotPositions(template.layout) : [];

  const loadPreview = () =>
    startLoading(async () => {
      if (!assetIds.length) {
        toast.error("กรุณาเลือกครุภัณฑ์");
        return;
      }
      setData(await getLabelData(assetIds));
    });

  const print = async () => {
    if (!template || !labels.length) return;
    const r = await logLabelPrint({ templateId: template.id, assetIds: template.kind === "ASSET" ? assetIds : [], copies, offset: startAt, total: labels.length });
    if (!r.ok) return toast.error(r.message ?? "พิมพ์ไม่ได้");
    // Wait a frame so barcodes/QR codes in the last sheet are drawn
    requestAnimationFrame(() => window.print());
  };

  if (!template) return <p className="text-muted-foreground">ยังไม่มีแม่แบบฉลาก</p>;
  const { layout } = template;

  return (
    <div className="space-y-6">
      <style>{`@page { size: ${layout.pageWidthMm}mm ${layout.pageHeightMm}mm; margin: 0; } @media print { .label-sheet-wrap { zoom: 1 !important; } }`}</style>

      <div className="grid gap-6 print:hidden lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <Step n={1} title="เลือกแม่แบบ">
            <Select
              value={templateId}
              onValueChange={(v) => {
                setTemplateId(v);
                setStartAt(1);
              }}
            >
              <SelectTrigger className="h-11! w-full rounded-xl" aria-label="แม่แบบ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.kind === "STATUS" ? "🏷️ " : ""}
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              ฉลาก {layout.labelWidthMm}×{layout.labelHeightMm} มม. · {perSheet} ดวงต่อแผ่น · กระดาษ {layout.pageWidthMm}×{layout.pageHeightMm} มม.
            </p>
          </Step>

          <Step n={2} title={template.kind === "ASSET" ? "เลือกครุภัณฑ์" : "จำนวนฉลาก"}>
            {template.kind === "ASSET" ? (
              <>
                <MultiSelect
                  key={defaultAssetIds.join(",")}
                  label="ครุภัณฑ์"
                  name="assetIds"
                  options={assets}
                  defaultValues={defaultAssetIds}
                  onChange={(v) => {
                    setAssetIds(v);
                    setData(null);
                  }}
                />
                <div className="flex flex-wrap items-end gap-3">
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">จำนวนต่อชิ้น</span>
                    <Input type="number" min={1} max={10} value={copies} onChange={(e) => setCopies(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} className="h-10 w-28 rounded-xl" />
                  </label>
                  <Button variant="outline" className="h-10 rounded-xl" onClick={loadPreview} disabled={loading || !assetIds.length}>
                    {loading ? <Loader2 className="animate-spin" /> : <Eye />} แสดงตัวอย่าง
                  </Button>
                </div>
              </>
            ) : (
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">จำนวนดวง</span>
                <Input type="number" min={1} max={1000} value={quantity} onChange={(e) => setQuantity(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} className="h-10 w-36 rounded-xl" />
              </label>
            )}
          </Step>
        </div>

        <Step n={3} title="เริ่มพิมพ์ที่ดวง (ข้ามดวงที่ใช้ไปแล้ว)">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
            role="radiogroup"
            aria-label="ดวงเริ่มต้น"
          >
            {Array.from({ length: perSheet }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={startAt === n}
                aria-label={`ดวงที่ ${n}`}
                onClick={() => setStartAt(n)}
                className={`h-7 rounded-md border text-[11px] transition ${
                  n < startAt ? "border-transparent bg-muted text-muted-foreground line-through" : n === startAt ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">เริ่มที่ดวงที่ {startAt} · ดวง 1–{startAt - 1 || 0} ของแผ่นแรกจะเว้นว่าง</p>
        </Step>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">
          {labels.length ? `ทั้งหมด ${labels.length} ดวง · ${sheets.length} แผ่น` : template.kind === "ASSET" ? "เลือกครุภัณฑ์แล้วกด \"แสดงตัวอย่าง\"" : ""}
        </p>
        <Button variant="gradient" className="h-11 rounded-xl px-5" onClick={print} disabled={!labels.length}>
          <Printer /> พิมพ์ฉลาก
        </Button>
      </div>

      {/* Sheets: scaled down on screen, real size when printing */}
      <div className="label-sheet-wrap space-y-6 print:space-y-0" style={{ zoom: 0.6 }}>
        {sheets.map((cells, si) => (
          <div
            key={si}
            className="relative mx-auto bg-white shadow-lg print:mx-0 print:shadow-none print:break-after-page"
            style={{ width: `${layout.pageWidthMm}mm`, height: `${layout.pageHeightMm}mm` }}
            aria-label={`แผ่นที่ ${si + 1}`}
          >
            {cells.map((cell, ci) =>
              // Empty (skipped) slots render nothing on paper
              si === 0 && ci < startAt - 1 ? null : (
                <div key={ci} className="absolute" style={{ left: `${slots[ci].x}mm`, top: `${slots[ci].y}mm` }}>
                  <LabelView width={layout.labelWidthMm} height={layout.labelHeightMm} elements={template.design.elements} data={cell} ctx={ctx} />
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
