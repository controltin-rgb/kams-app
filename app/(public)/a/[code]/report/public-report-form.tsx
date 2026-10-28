"use client";

import { CheckCircle2 } from "lucide-react";
import { CheckboxField, Field, FormMessage, SubmitButton, TextareaField } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { createPublicTicket } from "@/modules/tickets/actions";

export function PublicReportForm({ assetCode }: { assetCode: string }) {
  const { state, onSubmit, pending } = useFormAction(createPublicTicket);
  const fe = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-14 animate-pop text-emerald-500" />
        <p className="text-lg font-semibold">{state.message}</p>
        <p className="text-sm text-muted-foreground">เจ้าหน้าที่จะติดต่อกลับตามข้อมูลที่ให้ไว้</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="assetCode" value={assetCode} />
      {/* Honeypot: hidden from people, bots tend to fill it */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="หัวข้อปัญหา" name="title" required placeholder="เช่น เปิดไม่ติด" errors={fe.title} />
      <TextareaField label="รายละเอียด" name="description" rows={4} errors={fe.description} />
      <CheckboxField label="ใช้งานไม่ได้เลย" name="assetUnusable" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อผู้แจ้ง" name="reporterName" required autoComplete="name" errors={fe.reporterName} />
        <Field label="เบอร์โทร / อีเมล" name="reporterContact" required autoComplete="tel" errors={fe.reporterContact} />
      </div>
      <Field label="สถานที่ / จุดที่พบ" name="locationText" errors={fe.locationText} />
      {!state.fieldErrors && <FormMessage message={state.message} />}
      <div className="flex justify-end">
        <SubmitButton pending={pending}>ส่งเรื่องแจ้งซ่อม</SubmitButton>
      </div>
    </form>
  );
}
