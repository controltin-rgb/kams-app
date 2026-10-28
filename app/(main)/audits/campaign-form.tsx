"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, FormMessage, SubmitButton, TextareaField } from "@/components/forms/field";
import { MultiSelect } from "@/components/forms/multi-select";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { saveCampaign } from "@/modules/audits/actions";
import type { CampaignFormOptions } from "@/modules/audits/queries";

type Defaults = {
  id?: string;
  title?: string;
  year?: number;
  startDate?: string;
  endDate?: string;
  note?: string | null;
  scopeLocationIds?: string[];
  auditorIds?: string[];
};

export function CampaignForm({ options, defaults = {}, scopeLocked = false }: { options: CampaignFormOptions; defaults?: Defaults; scopeLocked?: boolean }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveCampaign, (s) => {
    toast.success(s.message);
    if (s.data?.id) router.push(`/audits/${s.data.id}`);
  });
  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <Field label="ชื่อรอบตรวจนับ" name="title" required defaultValue={defaults.title} placeholder="เช่น ตรวจนับประจำปี 2569 อาคาร A" errors={fe.title} />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="ปี (ค.ศ.)" name="year" type="number" required defaultValue={defaults.year ?? new Date().getFullYear()} errors={fe.year} />
          <Field label="วันเริ่ม" name="startDate" type="date" required defaultValue={defaults.startDate ?? today} errors={fe.startDate} />
          <Field label="วันสิ้นสุด" name="endDate" type="date" required defaultValue={defaults.endDate ?? today} errors={fe.endDate} />
        </div>
        {scopeLocked ? (
          <>
            <input type="hidden" name="scopeLocationIds" value={(defaults.scopeLocationIds ?? []).join(",")} />
            <p className="text-sm text-muted-foreground">ขอบเขตสถานที่แก้ไขไม่ได้หลังเริ่มตรวจนับ</p>
          </>
        ) : (
          <MultiSelect
            label="สถานที่ที่ตรวจนับ"
            name="scopeLocationIds"
            options={options.locations}
            defaultValues={defaults.scopeLocationIds}
            required
            placeholder="เลือกอาคาร/ชั้น/ห้อง (รวมสถานที่ย่อยทั้งหมด)"
            errors={fe.scopeLocationIds}
          />
        )}
        <MultiSelect label="ผู้ตรวจนับ" name="auditorIds" options={options.auditors} defaultValues={defaults.auditorIds} required placeholder="เลือกผู้ตรวจนับ" errors={fe.auditorIds} />
        <TextareaField label="หมายเหตุ" name="note" rows={2} defaultValue={defaults.note ?? undefined} errors={fe.note} />
      </section>
      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <Link href={defaults.id ? `/audits/${defaults.id}` : "/audits"}>ยกเลิก</Link>
        </Button>
        <SubmitButton pending={pending}>{defaults.id ? "บันทึก" : "สร้างรอบตรวจนับ"}</SubmitButton>
      </div>
    </form>
  );
}
