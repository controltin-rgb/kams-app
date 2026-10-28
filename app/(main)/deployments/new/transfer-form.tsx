"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, PackageCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Field, FormMessage, SelectField, SubmitButton, TextareaField } from "@/components/forms/field";
import { MultiSelect } from "@/components/forms/multi-select";
import { SignaturePad } from "@/components/forms/signature-pad";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { assetStatusLabels, returnStatuses } from "@/lib/labels";
import { createTransfer } from "@/modules/deployments/actions";
import type { DeploymentOptions } from "@/modules/deployments/queries";

type Kind = "HANDOVER" | "RETURN" | "MOVE";

const kinds: { value: Kind; label: string; hint: string; icon: typeof PackageCheck }[] = [
  { value: "HANDOVER", label: "ส่งมอบ", hint: "มอบให้ผู้ใช้ สถานะเป็น 'ใช้งานอยู่'", icon: PackageCheck },
  { value: "RETURN", label: "คืนคลัง", hint: "ผู้ใช้คืน ล้างผู้ถือครอง", icon: Undo2 },
  { value: "MOVE", label: "ย้ายสถานที่", hint: "เปลี่ยนสถานที่/แผนก ไม่เปลี่ยนผู้ถือครอง", icon: ArrowRightLeft },
];

export function TransferForm({ options, defaultAssetIds, defaultType }: { options: DeploymentOptions; defaultAssetIds: string[]; defaultType: Kind }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(defaultType);
  const { state, onSubmit, pending } = useFormAction(createTransfer, (s) => {
    toast.success(s.message);
    if (s.data?.id) router.push(`/deployments/${s.data.id}`);
  });
  const fe = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="type" value={kind} />
      <section className="animate-fade-up space-y-5 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="ประเภทเอกสาร">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => setKind(k.value)}
              className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
                kind === k.value ? "border-primary bg-accent" : "border-border hover:border-primary/40"
              }`}
            >
              <k.icon className={`mt-0.5 size-5 shrink-0 ${kind === k.value ? "text-primary" : "text-muted-foreground"}`} />
              <span>
                <span className="block font-semibold">{k.label}</span>
                <span className="text-xs text-muted-foreground">{k.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <MultiSelect
          label="ครุภัณฑ์"
          name="assetIds"
          required
          options={options.rootAssets}
          defaultValues={defaultAssetIds}
          placeholder="ค้นหารหัส ชื่อ หรือผู้ถือครอง..."
          errors={fe.assetIds}
        />
        <p className="-mt-3 text-xs text-muted-foreground">ชิ้นส่วนในชุด (Bundle) ย้ายตามตัวชุดอัตโนมัติ — ไม่แสดงในรายการนี้</p>

        <div className="grid gap-4 md:grid-cols-3">
          {kind === "HANDOVER" && <SelectField label="ผู้รับมอบ" name="toOwnerId" options={options.users} required errors={fe.toOwnerId} />}
          <SelectField
            label={kind === "RETURN" ? "สถานที่เก็บ" : "สถานที่ปลายทาง"}
            name="toLocationId"
            options={options.locations}
            allowEmpty={kind !== "RETURN"}
            emptyLabel="- ไม่เปลี่ยน -"
            required={kind === "RETURN"}
            errors={fe.toLocationId}
          />
          <SelectField label="แผนก" name="toDepartmentId" options={options.departments} allowEmpty emptyLabel="- ไม่เปลี่ยน -" errors={fe.toDepartmentId} />
          {kind === "RETURN" && (
            <SelectField
              label="สถานะหลังคืน"
              name="returnStatus"
              options={returnStatuses.map((s) => ({ value: s, label: assetStatusLabels[s] }))}
              defaultValue="SPARE"
              required
            />
          )}
        </div>
        <TextareaField label="หมายเหตุ / เหตุผล" name="reason" rows={2} errors={fe.reason} />
      </section>

      <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 [animation-delay:80ms] sm:p-7">
        <SignaturePad />
        <Field label="ชื่อผู้ลงนาม" name="signedByName" placeholder="ชื่อ-นามสกุล ผู้รับมอบ/ผู้คืน" errors={fe.signedByName} />
      </section>

      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <Link href="/deployments">ยกเลิก</Link>
        </Button>
        <SubmitButton pending={pending}>บันทึกเอกสาร</SubmitButton>
      </div>
    </form>
  );
}
