"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Barcode, ChevronLeft, Copy, Eye, Image as ImageIcon, Loader2, QrCode, Save, Square, Trash2, Type, Variable, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { LabelView } from "@/components/labels/label-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveTemplate, uploadLabelImage } from "@/modules/labels/actions";
import {
  labelFields,
  newElementId,
  paperPresets,
  sampleLabelData,
  type LabelElement,
  type LabelField,
  type LabelLayout,
} from "@/modules/labels/design";
import type { TemplateDetail } from "@/modules/labels/queries";

// Konva touches `window`; load it on the client only
const KonvaStage = dynamic(() => import("./konva-stage").then((m) => m.KonvaStage), {
  ssr: false,
  loading: () => <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />,
});

function Num({ label, value, onChange, step = 0.5, min }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={step}
        min={min}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 rounded-lg"
      />
    </label>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

const layoutFields: [keyof LabelLayout, string, number?][] = [
  ["pageWidthMm", "กว้างกระดาษ (มม.)"],
  ["pageHeightMm", "สูงกระดาษ (มม.)"],
  ["labelWidthMm", "กว้างฉลาก (มม.)"],
  ["labelHeightMm", "สูงฉลาก (มม.)"],
  ["columns", "จำนวนคอลัมน์", 1],
  ["rows", "จำนวนแถว", 1],
  ["marginTopMm", "ขอบบน (มม.)"],
  ["marginLeftMm", "ขอบซ้าย (มม.)"],
  ["gapXMm", "ระยะห่างแนวนอน (มม.)"],
  ["gapYMm", "ระยะห่างแนวตั้ง (มม.)"],
];

export function LabelEditor({ template, orgName, canEdit }: { template: TemplateDetail; orgName: string; canEdit: boolean }) {
  const [name, setName] = useState(template.name);
  const [preset, setPreset] = useState(template.paperPreset);
  const [layout, setLayout] = useState<LabelLayout>(template.layout);
  const [elements, setElements] = useState<LabelElement[]>(template.design.elements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(10); // px per mm
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const isAsset = template.kind === "ASSET";

  const update = useCallback((id: string, patch: Partial<LabelElement>) => {
    setElements((els) => els.map((e) => (e.id === id ? ({ ...e, ...patch } as LabelElement) : e)));
    setDirty(true);
  }, []);

  const add = (el: LabelElement) => {
    setElements((els) => [...els, el]);
    setSelectedId(el.id);
    setDirty(true);
  };

  const remove = useCallback(() => {
    if (!selectedId) return;
    setElements((els) => els.filter((e) => e.id !== selectedId));
    setSelectedId(null);
    setDirty(true);
  }, [selectedId]);

  // Keyboard: Delete removes, arrows nudge 0.5 mm (1 mm with Shift)
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (!selectedId || ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || (e.target as HTMLElement).isContentEditable) return;
      const step = e.shiftKey ? 1 : 0.5;
      const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      } else if (move[e.key]) {
        e.preventDefault();
        const el = elements.find((x) => x.id === selectedId);
        if (el) update(selectedId, { x: el.x + move[e.key][0], y: el.y + move[e.key][1] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, selectedId, elements, update, remove]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const W = layout.labelWidthMm;
  const H = layout.labelHeightMm;
  const center = (w: number, h: number) => ({ x: Math.max(0, (W - w) / 2), y: Math.max(0, (H - h) / 2), w, h, rotation: 0 });
  const textStyle = { fontSize: 8, bold: false, align: "left" as const, color: "#000000" };

  const save = () =>
    startSaving(async () => {
      const result = await saveTemplate({ id: template.id, name, paperPreset: preset, layout, design: { elements } });
      if (result.ok) {
        toast.success(result.message);
        setDirty(false);
      } else toast.error(result.message);
    });

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("templateId", template.id);
    fd.set("file", file);
    const result = await uploadLabelImage(fd);
    setUploading(false);
    if (result.ok && result.data?.id) add({ id: newElementId(), type: "image", attachmentId: result.data.id, ...center(Math.min(15, W / 3), Math.min(15, H / 2)) });
    else toast.error(result.message ?? "อัปโหลดไม่สำเร็จ");
  };

  const tools: { label: string; icon: typeof Type; onClick: () => void; show?: boolean }[] = [
    { label: "ข้อความ", icon: Type, onClick: () => add({ id: newElementId(), type: "text", text: "ข้อความ", ...textStyle, ...center(Math.min(30, W - 2), 5) }) },
    {
      label: "ฟิลด์ข้อมูล",
      icon: Variable,
      show: isAsset,
      onClick: () => add({ id: newElementId(), type: "field", field: "assetCode", prefix: "", ...textStyle, bold: true, ...center(Math.min(30, W - 2), 5) }),
    },
    { label: "Barcode", icon: Barcode, show: isAsset, onClick: () => add({ id: newElementId(), type: "barcode", showText: true, ...center(Math.min(30, W - 2), Math.min(10, H - 2)) }) },
    { label: "QR Code", icon: QrCode, show: isAsset, onClick: () => add({ id: newElementId(), type: "qr", ...center(Math.min(18, H - 2), Math.min(18, H - 2)) }) },
    { label: "กรอบ/พื้นสี", icon: Square, onClick: () => add({ id: newElementId(), type: "rect", fill: "transparent", stroke: "#000000", strokeWidth: 0.3, radius: 1, ...center(W - 2, H - 2) }) },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 shadow-sm shadow-black/4">
        <Button asChild variant="ghost" size="sm" className="rounded-lg">
          <Link href="/labels">
            <ChevronLeft /> แม่แบบ
          </Link>
        </Button>
        <Input value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} disabled={!canEdit} aria-label="ชื่อแม่แบบ" className="h-9 w-64 rounded-lg font-semibold" />
        <span className="mx-1 h-6 w-px bg-border" />
        {canEdit &&
          tools
            .filter((t) => t.show !== false)
            .map((t) => (
              <Button key={t.label} variant="outline" size="sm" className="rounded-lg" onClick={t.onClick}>
                <t.icon /> {t.label}
              </Button>
            ))}
        {canEdit && (
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />} รูป/โลโก้
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => (onUpload(e.target.files?.[0]), (e.target.value = ""))} />
          </label>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="ย่อ" onClick={() => setZoom((z) => Math.max(4, z - 2))}>
            <ZoomOut />
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground">{Math.round((zoom / 10) * 100)}%</span>
          <Button variant="ghost" size="icon-sm" aria-label="ขยาย" onClick={() => setZoom((z) => Math.min(24, z + 2))}>
            <ZoomIn />
          </Button>
          <Button variant={preview ? "secondary" : "ghost"} size="sm" className="rounded-lg" onClick={() => setPreview((p) => !p)}>
            <Eye /> ตัวอย่างจริง
          </Button>
          {canEdit && (
            <Button variant="gradient" size="sm" className="rounded-lg px-3" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} บันทึก{dirty && " *"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Canvas */}
        <div className="flex min-h-80 flex-col items-center justify-center gap-4 overflow-auto rounded-[28px] bg-muted/40 p-6">
          {preview ? (
            <div className="space-y-2 text-center">
              <div className="inline-block shadow-lg" style={{ zoom: zoom / 3.78 }}>
                <LabelView width={W} height={H} elements={elements} data={isAsset ? { ...sampleLabelData, orgName } : null} ctx={{ orgName, now: new Date(), origin: "https://ams.example" }} />
              </div>
              <p className="text-xs text-muted-foreground">ตัวอย่างขนาดจริงตามที่จะพิมพ์ (ข้อมูลตัวอย่าง)</p>
            </div>
          ) : (
            <KonvaStage
              widthMm={W}
              heightMm={H}
              scale={zoom}
              elements={elements}
              selectedId={selectedId}
              orgName={orgName}
              readOnly={!canEdit}
              onSelect={setSelectedId}
              onChange={update}
            />
          )}
          <p className="text-xs text-muted-foreground">
            ฉลาก {W}×{H} มม. · ลากเพื่อย้าย, ลากมุมเพื่อปรับขนาด/หมุน · ลูกศรขยับ 0.5 มม. (Shift = 1 มม.) · Delete ลบ
          </p>
        </div>

        {/* Properties */}
        <div className="space-y-4">
          {selected ? (
            <Panel title="องค์ประกอบที่เลือก">
              <div className="grid grid-cols-2 gap-2">
                <Num label="X (มม.)" value={selected.x} onChange={(v) => update(selected.id, { x: v })} />
                <Num label="Y (มม.)" value={selected.y} onChange={(v) => update(selected.id, { y: v })} />
                <Num label="กว้าง (มม.)" value={selected.w} min={1} onChange={(v) => update(selected.id, { w: Math.max(1, v) })} />
                <Num label="สูง (มม.)" value={selected.h} min={1} onChange={(v) => update(selected.id, { h: Math.max(1, v) })} />
                <Num label="หมุน (องศา)" value={selected.rotation} step={90} onChange={(v) => update(selected.id, { rotation: v })} />
              </div>

              {selected.type === "text" && (
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">ข้อความ (ใช้ {"{orgName}"} {"{yearBE}"} {"{date}"} ได้)</span>
                  <Textarea value={selected.text} onChange={(e) => update(selected.id, { text: e.target.value })} className="min-h-16 rounded-lg" />
                </label>
              )}
              {selected.type === "field" && (
                <>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">ฟิลด์</span>
                    <Select value={selected.field} onValueChange={(v) => update(selected.id, { field: v as LabelField })}>
                      <SelectTrigger className="h-9! w-full rounded-lg" aria-label="ฟิลด์">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(labelFields).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">ข้อความนำหน้า</span>
                    <Input value={selected.prefix} onChange={(e) => update(selected.id, { prefix: e.target.value })} className="h-9 rounded-lg" placeholder="เช่น S/N " />
                  </label>
                </>
              )}
              {(selected.type === "text" || selected.type === "field") && (
                <div className="grid grid-cols-2 gap-2">
                  <Num label="ขนาดตัวอักษร (pt)" value={selected.fontSize} step={0.5} min={3} onChange={(v) => update(selected.id, { fontSize: Math.max(3, v) })} />
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">สี</span>
                    <Input type="color" value={selected.color} onChange={(e) => update(selected.id, { color: e.target.value })} className="h-9 rounded-lg p-1" />
                  </label>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">จัดวาง</span>
                    <Select value={selected.align} onValueChange={(v) => update(selected.id, { align: v as "left" | "center" | "right" })}>
                      <SelectTrigger className="h-9! w-full rounded-lg" aria-label="จัดวาง">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">ชิดซ้าย</SelectItem>
                        <SelectItem value="center">กึ่งกลาง</SelectItem>
                        <SelectItem value="right">ชิดขวา</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <Checkbox checked={selected.bold} onCheckedChange={(c) => update(selected.id, { bold: c === true })} /> ตัวหนา
                  </label>
                </div>
              )}
              {selected.type === "barcode" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.showText} onCheckedChange={(c) => update(selected.id, { showText: c === true })} /> แสดงรหัสใต้บาร์โค้ด
                </label>
              )}
              {selected.type === "rect" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">สีพื้น</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={selected.fill === "transparent" ? "#ffffff" : selected.fill}
                        onChange={(e) => update(selected.id, { fill: e.target.value })}
                        className="h-9 rounded-lg p-1"
                      />
                      <Button variant="ghost" size="xs" onClick={() => update(selected.id, { fill: "transparent" })}>
                        ไม่มี
                      </Button>
                    </div>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">สีเส้น</span>
                    <Input
                      type="color"
                      value={selected.stroke === "transparent" ? "#000000" : selected.stroke}
                      onChange={(e) => update(selected.id, { stroke: e.target.value })}
                      className="h-9 rounded-lg p-1"
                    />
                  </label>
                  <Num label="ความหนาเส้น (มม.)" value={selected.strokeWidth} step={0.1} min={0} onChange={(v) => update(selected.id, { strokeWidth: Math.max(0, v) })} />
                  <Num label="มุมโค้ง (มม.)" value={selected.radius} step={0.5} min={0} onChange={(v) => update(selected.id, { radius: Math.max(0, v) })} />
                </div>
              )}

              {canEdit && (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => add({ ...selected, id: newElementId(), x: selected.x + 1, y: selected.y + 1 })}>
                    <Copy /> ทำซ้ำ
                  </Button>
                  <Button variant="destructive" size="sm" className="rounded-lg" onClick={remove}>
                    <Trash2 /> ลบ
                  </Button>
                </div>
              )}
            </Panel>
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">คลิกองค์ประกอบบนฉลากเพื่อแก้ไขคุณสมบัติ</p>
          )}

          <Panel title="กระดาษและการจัดวาง">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">แม่แบบกระดาษ</span>
              <Select
                value={preset}
                disabled={!canEdit}
                onValueChange={(v) => {
                  setPreset(v);
                  if (v !== "CUSTOM") {
                    const { label: _l, ...l } = paperPresets[v];
                    void _l;
                    setLayout(l);
                  }
                  setDirty(true);
                }}
              >
                <SelectTrigger className="h-9! w-full rounded-lg" aria-label="แม่แบบกระดาษ">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(paperPresets).map(([value, p]) => (
                    <SelectItem key={value} value={value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {layoutFields.map(([key, label, step]) => (
                <Num
                  key={key}
                  label={label}
                  value={layout[key]}
                  step={step ?? 0.1}
                  onChange={(v) => {
                    if (!canEdit) return;
                    setLayout((l) => ({ ...l, [key]: v }));
                    setPreset("CUSTOM");
                    setDirty(true);
                  }}
                />
              ))}
            </div>
            <Label className="text-xs font-normal text-muted-foreground">
              {layout.columns * layout.rows} ดวงต่อแผ่น
            </Label>
          </Panel>
        </div>
      </div>
    </div>
  );
}
