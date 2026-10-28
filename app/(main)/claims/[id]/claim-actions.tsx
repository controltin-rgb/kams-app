"use client";

import { PackageCheck, RefreshCcw, Wrench, X } from "lucide-react";
import { Field, TextareaField } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import type { ClaimStatus } from "@/generated/prisma/enums";
import { updateClaim } from "@/modules/claims/actions";

export function ClaimActions({ claimId, status, currentSerial }: { claimId: string; status: ClaimStatus; currentSerial: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  if (status !== "SENT" && status !== "IN_REPAIR") return <p className="text-sm text-muted-foreground">ปิดรายการเคลมแล้ว</p>;

  return (
    <div className="flex flex-col gap-2">
      {status === "SENT" && (
        <FormDialog
          title="ผู้ขายรับเรื่องและกำลังซ่อม"
          action={updateClaim}
          hidden={{ claimId, status: "IN_REPAIR" }}
          submitLabel="ยืนยัน"
          trigger={
            <Button variant="outline" className="h-11 w-full rounded-xl">
              <Wrench /> ผู้ขายกำลังซ่อม
            </Button>
          }
        >
          {(state) => <TextareaField label="หมายเหตุ (ไม่บังคับ)" name="note" rows={2} errors={state.fieldErrors?.note} />}
        </FormDialog>
      )}
      <FormDialog
        title="รับคืน (ซ่อมเสร็จ)"
        description="สถานะครุภัณฑ์จะกลับเป็นสถานะก่อนส่งเคลม"
        action={updateClaim}
        hidden={{ claimId, status: "RETURNED" }}
        submitLabel="บันทึกรับคืน"
        trigger={
          <Button variant="gradient" className="h-11 w-full rounded-xl">
            <PackageCheck /> รับคืน
          </Button>
        }
      >
        {(state) => (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="วันที่รับคืน" name="actualReturnDate" type="date" required defaultValue={today} errors={state.fieldErrors?.actualReturnDate} />
              <Field label="ค่าใช้จ่าย (บาท)" name="cost" inputMode="decimal" placeholder="0.00" errors={state.fieldErrors?.cost} />
            </div>
            <TextareaField label="ผลการซ่อม / หมายเหตุ" name="note" rows={2} />
          </>
        )}
      </FormDialog>
      <FormDialog
        title="ผู้ขายเปลี่ยนเครื่องใหม่"
        description="ครุภัณฑ์คงรหัสเดิม ระบบบันทึก Serial ใหม่และเก็บ Serial เดิมไว้ในประวัติ"
        action={updateClaim}
        hidden={{ claimId, status: "REPLACED" }}
        submitLabel="บันทึกเปลี่ยนเครื่อง"
        trigger={
          <Button variant="outline" className="h-11 w-full rounded-xl">
            <RefreshCcw /> เปลี่ยนเครื่องใหม่
          </Button>
        }
      >
        {(state) => (
          <>
            <p className="text-sm text-muted-foreground">Serial เดิม: {currentSerial || "-"}</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Serial ใหม่" name="newSerial" required errors={state.fieldErrors?.newSerial} />
              <Field label="ประกันหมดอายุ (ใหม่)" name="newWarrantyExpiry" type="date" errors={state.fieldErrors?.newWarrantyExpiry} />
              <Field label="วันที่รับคืน" name="actualReturnDate" type="date" required defaultValue={today} errors={state.fieldErrors?.actualReturnDate} />
              <Field label="ค่าใช้จ่าย (บาท)" name="cost" inputMode="decimal" placeholder="0.00" errors={state.fieldErrors?.cost} />
            </div>
          </>
        )}
      </FormDialog>
      <FormDialog
        title="ยกเลิกการเคลม"
        description="สถานะครุภัณฑ์จะกลับเป็นสถานะก่อนส่งเคลม"
        action={updateClaim}
        hidden={{ claimId, status: "CANCELLED" }}
        submitLabel="ยืนยันยกเลิก"
        trigger={
          <Button variant="destructive" className="h-11 w-full rounded-xl">
            <X /> ยกเลิก
          </Button>
        }
      >
        {(state) => <TextareaField label="เหตุผล" name="note" required rows={2} errors={state.fieldErrors?.note} />}
      </FormDialog>
    </div>
  );
}
