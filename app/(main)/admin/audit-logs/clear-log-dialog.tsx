"use client";

import { Trash2 } from "lucide-react";
import { Field, SelectField } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { clearLogs } from "@/modules/logs/actions";
import { CLEAR_CONFIRM_TEXT } from "@/modules/logs/schemas";

const ranges = [
  { value: "365", label: "เก่ากว่า 1 ปี" },
  { value: "180", label: "เก่ากว่า 180 วัน" },
  { value: "90", label: "เก่ากว่า 90 วัน" },
  { value: "30", label: "เก่ากว่า 30 วัน" },
  { value: "0", label: "ทั้งหมด" },
];

export function ClearLogDialog({ impersonating }: { impersonating: boolean }) {
  const trigger = (
    <Button variant="outline" className="h-10 rounded-xl text-destructive" disabled={impersonating} title={impersonating ? "ใช้ไม่ได้ขณะเข้าใช้งานแทนผู้อื่น" : undefined}>
      <Trash2 /> ล้าง Log
    </Button>
  );
  if (impersonating) return trigger;

  return (
    <FormDialog
      title="ล้าง Audit Log"
      description="ลบบันทึกเก่าออกถาวร การล้างครั้งนี้จะถูกบันทึกเป็น Log ใหม่เสมอ"
      trigger={trigger}
      action={clearLogs}
      submitLabel="ล้าง Log"
    >
      {(state) => (
        <>
          <SelectField label="ลบบันทึกที่" name="olderThanDays" options={ranges} defaultValue="365" required errors={state.fieldErrors?.olderThanDays} />
          <Field
            label={`พิมพ์ "${CLEAR_CONFIRM_TEXT}" เพื่อยืนยัน`}
            name="confirm"
            required
            autoComplete="off"
            errors={state.fieldErrors?.confirm}
          />
        </>
      )}
    </FormDialog>
  );
}
