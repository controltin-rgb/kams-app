"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, Cpu } from "lucide-react";
import { toast } from "sonner";
import { Field, FormMessage, SelectField, SubmitButton, TextareaField } from "@/components/forms/field";
import { SignaturePad } from "@/components/forms/signature-pad";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { assetStatusLabels, returnStatuses } from "@/lib/labels";
import { fullSwap, partialSwap } from "@/modules/deployments/actions";
import type { DeploymentOptions } from "@/modules/deployments/queries";

type Child = { parentId: string; value: string; label: string; categoryId: string };
const statusOptions = returnStatuses.map((s) => ({ value: s, label: assetStatusLabels[s] }));

function Signature({ fe }: { fe: Partial<Record<string, string[]>> }) {
  return (
    <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 [animation-delay:80ms] sm:p-7">
      <SignaturePad />
      <Field label="ชื่อผู้ลงนาม" name="signedByName" placeholder="ชื่อ-นามสกุล ผู้รับเครื่อง" errors={fe.signedByName} />
    </section>
  );
}

function Actions({ pending }: { pending: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button asChild variant="outline" className="h-11 rounded-xl px-5">
        <Link href="/deployments">ยกเลิก</Link>
      </Button>
      <SubmitButton pending={pending}>บันทึกการเปลี่ยน</SubmitButton>
    </div>
  );
}

function useSwap(action: typeof partialSwap | typeof fullSwap) {
  const router = useRouter();
  return useFormAction(action, (s) => {
    toast.success(s.message);
    if (s.data?.id) router.push(`/deployments/${s.data.id}`);
  });
}

function PartialForm({ options, parts, defaultParent }: { options: DeploymentOptions; parts: Child[]; defaultParent?: string }) {
  const { state, onSubmit, pending } = useSwap(partialSwap);
  const [parentId, setParentId] = useState(defaultParent ?? "");
  const [oldChildId, setOldChildId] = useState("");
  const fe = (state.fieldErrors ?? {}) as Partial<Record<string, string[]>>;
  const kids = parts.filter((c) => c.parentId === parentId);
  const oldChild = kids.find((c) => c.value === oldChildId);
  const sameCategory = oldChild ? options.spareAssets.filter((a) => a.categoryId === oldChild.categoryId) : [];
  const replacements = sameCategory.length ? sameCategory : options.spareAssets;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <SelectField
          label="ชุดอุปกรณ์"
          name="parentId"
          options={options.bundles}
          defaultValue={defaultParent}
          required
          onValueChange={(v) => {
            setParentId(v);
            setOldChildId("");
          }}
          hint={options.bundles.length ? undefined : "ยังไม่มีชุดอุปกรณ์ — ติดตั้งชิ้นส่วนเข้าชุดจากหน้าครุภัณฑ์ก่อน"}
          errors={fe.parentId}
        />
        <div className="grid gap-4 md:grid-cols-2" key={parentId}>
          <SelectField label="ชิ้นที่ถอดออก" name="oldChildId" options={kids} required disabled={!parentId} onValueChange={setOldChildId} errors={fe.oldChildId} />
          <SelectField
            key={oldChildId}
            label="ชิ้นใหม่ (สำรอง)"
            name="newChildId"
            options={replacements}
            required
            disabled={!oldChildId}
            hint={oldChild && sameCategory.length ? "แสดงเฉพาะประเภทเดียวกัน" : undefined}
            errors={fe.newChildId}
          />
          <SelectField label="สถานะชิ้นที่ถอด" name="oldStatus" options={statusOptions} defaultValue="SPARE" required />
          <SelectField label="เก็บชิ้นที่ถอดไว้ที่" name="oldLocationId" options={options.locations} allowEmpty emptyLabel="- ที่เดิมของชุด -" errors={fe.oldLocationId} />
        </div>
        <SelectField label="อ้างอิงงานแจ้งซ่อม" name="ticketId" options={options.tickets} allowEmpty emptyLabel="- ไม่อ้างอิง -" />
        <TextareaField label="เหตุผล" name="reason" rows={2} errors={fe.reason} />
      </section>
      <Signature fe={fe} />
      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <Actions pending={pending} />
    </form>
  );
}

function FullForm({ options, defaultParent }: { options: DeploymentOptions; defaultParent?: string }) {
  const { state, onSubmit, pending } = useSwap(fullSwap);
  const fe = (state.fieldErrors ?? {}) as Partial<Record<string, string[]>>;
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="ชุดเดิม (ที่ใช้งานอยู่)" name="oldParentId" options={options.inUseSets} defaultValue={defaultParent} required errors={fe.oldParentId} />
          <SelectField label="ชุดใหม่ (สำรอง)" name="newParentId" options={options.spareAssets} required errors={fe.newParentId} />
          <SelectField label="สถานะชุดเดิม" name="oldStatus" options={statusOptions} defaultValue="SPARE" required />
          <SelectField label="เก็บชุดเดิมไว้ที่" name="oldLocationId" options={options.locations} required errors={fe.oldLocationId} />
        </div>
        <p className="text-xs text-muted-foreground">ชุดใหม่และชิ้นส่วนทั้งหมดจะรับผู้ถือครอง/สถานที่/แผนกของชุดเดิม ส่วนชุดเดิมพร้อมชิ้นส่วนกลับเข้าคลัง</p>
        <SelectField label="อ้างอิงงานแจ้งซ่อม" name="ticketId" options={options.tickets} allowEmpty emptyLabel="- ไม่อ้างอิง -" />
        <TextareaField label="เหตุผล" name="reason" rows={2} errors={fe.reason} />
      </section>
      <Signature fe={fe} />
      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <Actions pending={pending} />
    </form>
  );
}

export function SwapForms({
  options,
  bundleChildren,
  defaultMode,
  defaultParent,
}: {
  options: DeploymentOptions;
  bundleChildren: Child[];
  defaultMode: "partial" | "full";
  defaultParent?: string;
}) {
  const [mode, setMode] = useState(defaultMode);
  const tabs = [
    { key: "partial" as const, label: "เปลี่ยนชิ้นส่วน (Partial)", hint: "เช่น เปลี่ยนจอหรือเมาส์ในชุดคอมพิวเตอร์", icon: Cpu },
    { key: "full" as const, label: "เปลี่ยนทั้งชุด (Full Set)", hint: "ย้ายผู้ใช้ไปใช้อีกชุดพร้อมชิ้นส่วนทั้งหมด", icon: Boxes },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => setMode(t.key)}
            className={`flex items-start gap-3 rounded-2xl border-2 bg-card p-4 text-left transition ${mode === t.key ? "border-primary" : "border-transparent hover:border-primary/40"}`}
          >
            <t.icon className={`mt-0.5 size-5 shrink-0 ${mode === t.key ? "text-primary" : "text-muted-foreground"}`} />
            <span>
              <span className="block font-semibold">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {mode === "partial" ? (
        <PartialForm options={options} parts={bundleChildren} defaultParent={defaultParent} />
      ) : (
        <FullForm options={options} defaultParent={defaultParent} />
      )}
    </div>
  );
}
