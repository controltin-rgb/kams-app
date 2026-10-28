"use client";

import { useEffect } from "react";
import { Building, CalendarCheck, Clock, QrCode } from "lucide-react";
import { toast } from "sonner";
import { CheckboxField, Field, SubmitButton } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { ticketPriorityLabels } from "@/lib/labels";
import { saveTicketSettings } from "@/modules/settings/actions";

const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export function TicketSettingsForm({
  orgName,
  sla,
  allowAnonymousQr,
  pmLeadDays,
}: {
  orgName: string;
  sla: Record<(typeof priorities)[number], number>;
  allowAnonymousQr: boolean;
  pmLeadDays: number;
}) {
  const { state, onSubmit, pending } = useFormAction(saveTicketSettings);
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    else if (state.message) toast.error(state.message);
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
          <Building className="size-5 text-primary" /> ข้อมูลหน่วยงาน
        </h2>
        <Field label="ชื่อหน่วยงาน" name="orgName" required defaultValue={orgName} hint="แสดงบนฉลากและเอกสารที่พิมพ์" errors={fe.orgName} />
      </section>
      <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <h2 className="mb-1 flex items-center gap-2.5 text-lg font-semibold">
          <Clock className="size-5 text-primary" /> SLA งานแจ้งซ่อม
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">จำนวนชั่วโมงนับจากเวลาแจ้ง ถึงกำหนดแก้ไขเสร็จ (นับต่อเนื่อง ไม่หักวันหยุด)</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {priorities.map((p) => (
            <Field
              key={p}
              label={`${ticketPriorityLabels[p]} (ชั่วโมง)`}
              name={`sla${p}`}
              type="number"
              min={1}
              max={2160}
              required
              defaultValue={sla[p]}
              errors={fe[`sla${p}` as keyof typeof fe]}
            />
          ))}
        </div>
      </section>

      <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 [animation-delay:80ms] sm:p-7">
        <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
          <QrCode className="size-5 text-primary" /> แจ้งซ่อมจากการสแกน QR
        </h2>
        <CheckboxField
          label="อนุญาตให้แจ้งซ่อมโดยไม่ต้องเข้าสู่ระบบ"
          name="allowAnonymousQr"
          defaultChecked={allowAnonymousQr}
          hint="ผู้แจ้งต้องกรอกชื่อและเบอร์ติดต่อ ระบบจำกัด 5 ครั้งต่อชั่วโมงต่อ IP — ถ้าปิด ผู้สแกนต้องเข้าสู่ระบบก่อนแจ้ง"
        />
      </section>

      <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 [animation-delay:120ms] sm:p-7">
        <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
          <CalendarCheck className="size-5 text-primary" /> บำรุงรักษา (PM)
        </h2>
        <Field
          label="สร้างงาน PM ล่วงหน้า (วัน)"
          name="pmLeadDays"
          type="number"
          min={0}
          max={90}
          required
          defaultValue={pmLeadDays}
          className="max-w-xs"
          hint="งานจะปรากฏในปฏิทินก่อนถึงกำหนดตามจำนวนวันนี้"
          errors={fe.pmLeadDays}
        />
      </section>

      <div className="flex justify-end">
        <SubmitButton pending={pending}>บันทึกการตั้งค่า</SubmitButton>
      </div>
    </form>
  );
}
