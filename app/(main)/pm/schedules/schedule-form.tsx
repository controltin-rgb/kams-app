"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CheckboxField, Field, FormMessage, SelectField, SubmitButton, TextareaField } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checklistItemTypeLabels, pmFrequencyLabels } from "@/lib/labels";
import { saveSchedule } from "@/modules/pm/actions";
import type { ScheduleDetail, ScheduleFormOptions } from "@/modules/pm/queries";
import type { ChecklistItem } from "@/modules/pm/schemas";

const newId = () => Math.random().toString(36).slice(2, 10);

const starterChecklist: ChecklistItem[] = [
  { id: newId(), label: "ทำความสะอาดภายนอก", type: "CHECK", required: true },
  { id: newId(), label: "ตรวจสอบการทำงานทั่วไป", type: "CHECK", required: true },
];

function ChecklistEditor({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const update = (id: string, patch: Partial<ChecklistItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [it] = next.splice(index, 1);
    next.splice(index + delta, 0, it);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.id} className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-[2rem_1fr_10rem_6rem_auto] sm:items-center">
          <span className="text-sm font-semibold text-muted-foreground">{i + 1}.</span>
          <Input value={item.label} onChange={(e) => update(item.id, { label: e.target.value })} placeholder="รายการตรวจ" aria-label={`รายการตรวจที่ ${i + 1}`} className="h-9 rounded-lg" />
          <Select value={item.type} onValueChange={(v) => update(item.id, { type: v as ChecklistItem["type"] })}>
            <SelectTrigger className="h-9! w-full rounded-lg" aria-label={`ชนิดรายการที่ ${i + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(checklistItemTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={item.unit ?? ""}
            onChange={(e) => update(item.id, { unit: e.target.value || undefined })}
            placeholder="หน่วย"
            disabled={item.type !== "NUMBER"}
            aria-label={`หน่วยรายการที่ ${i + 1}`}
            className="h-9 rounded-lg"
          />
          <div className="flex items-center gap-1">
            <label className="mr-2 flex items-center gap-1.5 text-xs">
              <Checkbox checked={item.required} onCheckedChange={(c) => update(item.id, { required: c === true })} /> บังคับ
            </label>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="เลื่อนลง" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`ลบรายการที่ ${i + 1}`} className="hover:text-destructive" onClick={() => onChange(items.filter((x) => x.id !== item.id))}>
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => onChange([...items, { id: newId(), label: "", type: "CHECK", required: true }])}>
        <Plus /> เพิ่มรายการตรวจ
      </Button>
    </div>
  );
}

export function ScheduleForm({ options, schedule }: { options: ScheduleFormOptions; schedule?: ScheduleDetail }) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(schedule?.checklist.length ? schedule.checklist : starterChecklist);
  const { state, onSubmit, pending } = useFormAction(saveSchedule, (s) => {
    toast.success(s.message);
    router.push("/pm/schedules");
  });
  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {schedule && <input type="hidden" name="id" value={schedule.id} />}
      <input type="hidden" name="checklist" value={JSON.stringify(checklist.filter((c) => c.label.trim()))} />

      <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <Field label="ชื่อแผน" name="title" required defaultValue={schedule?.title} placeholder="เช่น ล้างแอร์ห้องประชุม" errors={fe.title} />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="ครุภัณฑ์" name="assetId" options={options.assets} allowEmpty defaultValue={schedule?.assetId} hint="หรือเลือกสถานที่ ถ้าเป็นงานของพื้นที่" errors={fe.assetId} />
          <SelectField label="สถานที่" name="locationId" options={options.locations} allowEmpty defaultValue={schedule?.locationId} errors={fe.locationId} />
          <SelectField
            label="ความถี่"
            name="frequency"
            options={Object.entries(pmFrequencyLabels).map(([value, label]) => ({ value, label }))}
            defaultValue={schedule?.frequency ?? "MONTHLY"}
            required
            errors={fe.frequency}
          />
          <Field label="เริ่มรอบแรก" name="startDate" type="date" required defaultValue={schedule?.startDate ?? today} hint="ถ้าเป็นวันที่ผ่านมาแล้ว ระบบเริ่มจากรอบถัดไป" errors={fe.startDate} />
          <SelectField label="ผู้รับผิดชอบ" name="assignedTechId" options={options.techs} allowEmpty defaultValue={schedule?.assignedTechId} errors={fe.assignedTechId} />
        </div>
        <TextareaField label="รายละเอียด / วิธีปฏิบัติ" name="description" rows={3} defaultValue={schedule?.description ?? undefined} errors={fe.description} />
        {schedule && <CheckboxField label="เปิดใช้แผนนี้" name="active" defaultChecked={schedule.active} hint="ปิดใช้แล้วระบบจะไม่สร้างงานใหม่" />}
      </section>

      <section className="animate-fade-up space-y-3 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 [animation-delay:80ms] sm:p-7">
        <h2 className="font-semibold">รายการตรวจเช็ก (Checklist)</h2>
        <ChecklistEditor items={checklist} onChange={setChecklist} />
        {fe.checklist?.[0] && <p className="text-sm text-destructive">{fe.checklist[0]}</p>}
      </section>

      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <Link href="/pm/schedules">ยกเลิก</Link>
        </Button>
        <SubmitButton pending={pending}>{schedule ? "บันทึกแผน" : "สร้างแผน"}</SubmitButton>
      </div>
    </form>
  );
}
