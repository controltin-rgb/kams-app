"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field, FormMessage, SelectField, SubmitButton, TextareaField } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { createClaim } from "@/modules/claims/actions";
import type { ClaimFormOptions } from "@/modules/claims/queries";

export function ClaimForm({ options, defaults }: { options: ClaimFormOptions; defaults: { assetId?: string; ticketId?: string; problem?: string } }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(createClaim, (s) => {
    toast.success(s.message);
    if (s.data?.id) router.push(`/claims/${s.data.id}`);
  });
  const fe = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="ครุภัณฑ์" name="assetId" options={options.assets} defaultValue={defaults.assetId} required errors={fe.assetId} />
          <SelectField
            label="ผู้ขาย / ศูนย์บริการ"
            name="vendorId"
            options={options.vendors}
            required
            hint={options.vendors.length ? undefined : "ยังไม่มีผู้ขาย — เพิ่มที่ ข้อมูลหลัก > ผู้ขาย"}
            errors={fe.vendorId}
          />
          <Field label="วันที่ส่ง" name="sentDate" type="date" required defaultValue={today} errors={fe.sentDate} />
          <Field label="คาดว่าได้คืน" name="expectedReturnDate" type="date" errors={fe.expectedReturnDate} />
        </div>
        <SelectField label="อ้างอิงงานแจ้งซ่อม" name="ticketId" options={options.tickets} allowEmpty emptyLabel="- ไม่อ้างอิง -" defaultValue={defaults.ticketId} errors={fe.ticketId} />
        <TextareaField label="อาการ / ปัญหา" name="problem" required rows={4} defaultValue={defaults.problem} errors={fe.problem} />
        <TextareaField label="หมายเหตุ / อุปกรณ์ที่ส่งไปด้วย" name="notes" rows={2} placeholder="เช่น สายไฟ, อะแดปเตอร์" errors={fe.notes} />
        <p className="text-xs text-muted-foreground">สถานะครุภัณฑ์จะเป็น &quot;ส่งเคลม&quot; จนกว่าจะบันทึกรับคืน แล้วคืนสถานะเดิมอัตโนมัติ</p>
      </section>
      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <Link href="/claims">ยกเลิก</Link>
        </Button>
        <SubmitButton pending={pending}>บันทึกส่งเคลม</SubmitButton>
      </div>
    </form>
  );
}
