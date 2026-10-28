"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardList, MapPin, Package, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { CheckboxField, Field, FormMessage, SelectField, SubmitButton, TextareaField } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
import { assetConditionLabels, assetStatusLabels, initialAssetStatuses } from "@/lib/labels";
import type { AssetFormOptions } from "@/modules/assets/queries";
import { PROP_PREFIX } from "@/modules/assets/schemas";

type Mode = "create" | "edit" | "bulk";

export type AssetFormValues = {
  id?: string;
  categoryId?: string;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  barcode?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  cost?: string | null;
  condition?: string;
  ownerId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  note?: string | null;
  propertyValues?: Record<string, string>;
};

type Action = (prev: FormState<Record<string, unknown>>, formData: FormData) => Promise<FormState<Record<string, unknown>>>;

function Section({ icon: Icon, title, children }: { icon: typeof Package; title: string; children: ReactNode }) {
  return (
    <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
      <h2 className="mb-5 flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-4.5" />
        </span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const conditionOptions = Object.entries(assetConditionLabels).map(([value, label]) => ({ value, label }));
const statusOptions = initialAssetStatuses.map((s) => ({ value: s, label: assetStatusLabels[s] }));

export function AssetForm({
  mode,
  action,
  options,
  values = {},
  cancelHref,
}: {
  mode: Mode;
  action: Action;
  options: AssetFormOptions;
  values?: AssetFormValues;
  cancelHref: string;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  const [categoryId, setCategoryId] = useState(values.categoryId ?? "");
  const [formKey, setFormKey] = useState(0);
  const [prevState, setPrevState] = useState(state);
  const category = options.categories.find((c) => c.id === categoryId);
  const fe = (state.fieldErrors ?? {}) as Record<string, string[] | undefined>;

  // Bulk mode stays on the page: remount the form (clearing inputs) after each successful batch
  if (state !== prevState) {
    setPrevState(state);
    if (state.ok) setFormKey((k) => k + 1);
  }

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
    } else if (state.message && !state.ok) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form key={formKey} onSubmit={onSubmit} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Section icon={Package} title="ข้อมูลครุภัณฑ์">
        <div className="grid gap-4 md:grid-cols-2">
          {mode === "edit" ? (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">ประเภท</p>
              <p className="flex h-12 items-center rounded-xl border border-border bg-muted/40 px-4 text-muted-foreground">
                {category ? `${category.name} (${category.codePrefix})` : "-"}
              </p>
            </div>
          ) : (
            <SelectField
              label="ประเภท"
              name="categoryId"
              required
              defaultValue={categoryId || undefined}
              onValueChange={setCategoryId}
              options={options.categories.map((c) => ({ value: c.id, label: `${c.name} (${c.codePrefix})` }))}
              hint={category ? `รหัสจะถูกสร้างอัตโนมัติ เช่น ${category.codePrefix}-${new Date().getFullYear()}-0001` : undefined}
              errors={fe.categoryId}
            />
          )}
          <Field label="ชื่อครุภัณฑ์" name="name" defaultValue={values.name} required errors={fe.name} />
          <Field label="ยี่ห้อ" name="brand" defaultValue={values.brand ?? undefined} errors={fe.brand} />
          <Field label="รุ่น" name="model" defaultValue={values.model ?? undefined} errors={fe.model} />
          {mode !== "bulk" && (
            <>
              <Field label="Serial Number" name="serialNumber" defaultValue={values.serialNumber ?? undefined} errors={fe.serialNumber} />
              <Field label="บาร์โค้ดผู้ผลิต" name="barcode" defaultValue={values.barcode ?? undefined} hint="ไม่บังคับ — ฉลากของระบบใช้รหัสครุภัณฑ์" errors={fe.barcode} />
            </>
          )}
          {mode !== "edit" && (
            <SelectField label="สถานะเริ่มต้น" name="status" options={statusOptions} defaultValue="SPARE" required errors={fe.status} />
          )}
          <SelectField label="สภาพ" name="condition" options={conditionOptions} defaultValue={values.condition ?? "GOOD"} required errors={fe.condition} />
        </div>
        {mode === "edit" && (
          <p className="text-xs text-muted-foreground">สถานะครุภัณฑ์เปลี่ยนผ่านงานแจ้งซ่อม / Swap / ส่งเคลม / ตรวจนับ เท่านั้น</p>
        )}
      </Section>

      {mode === "bulk" && (
        <Section icon={ClipboardList} title="จำนวนที่สร้าง">
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <Field label="จำนวน" name="quantity" type="number" min={1} max={100} defaultValue={1} required errors={fe.quantity} />
            <TextareaField
              label="Serial Number (ไม่บังคับ)"
              name="serialNumbers"
              rows={5}
              placeholder={"SN001\nSN002\n..."}
              hint="หนึ่งรายการต่อบรรทัด ต้องเท่ากับจำนวนที่สร้าง"
              errors={fe.serialNumbers}
            />
          </div>
        </Section>
      )}

      {category && category.propertyDefs.length > 0 && (
        <Section icon={SlidersHorizontal} title={`ข้อมูลเฉพาะ: ${category.name}`}>
          <div key={category.id} className="grid gap-4 md:grid-cols-2">
            {category.propertyDefs.map((p) => {
              const name = `${PROP_PREFIX}${p.key}`;
              const value = values.propertyValues?.[p.key];
              const errors = fe[name];
              switch (p.type) {
                case "SELECT":
                  return (
                    <SelectField
                      key={p.key}
                      label={p.label}
                      name={name}
                      required={p.required}
                      allowEmpty={!p.required}
                      defaultValue={value}
                      options={p.options.map((o) => ({ value: o, label: o }))}
                      errors={errors}
                    />
                  );
                case "BOOLEAN":
                  return <CheckboxField key={p.key} label={p.label} name={name} defaultChecked={value === "true"} />;
                default:
                  return (
                    <Field
                      key={p.key}
                      label={p.label}
                      name={name}
                      type={p.type === "NUMBER" ? "number" : p.type === "DATE" ? "date" : "text"}
                      step={p.type === "NUMBER" ? "any" : undefined}
                      required={p.required}
                      defaultValue={value}
                      errors={errors}
                    />
                  );
              }
            })}
          </div>
        </Section>
      )}

      <Section icon={CalendarClock} title="การจัดซื้อและประกัน">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="วันที่ซื้อ" name="purchaseDate" type="date" defaultValue={values.purchaseDate ?? undefined} errors={fe.purchaseDate} />
          <Field label="ประกันหมดอายุ" name="warrantyExpiry" type="date" defaultValue={values.warrantyExpiry ?? undefined} errors={fe.warrantyExpiry} />
          <Field label="ราคา (บาท)" name="cost" inputMode="decimal" placeholder="0.00" defaultValue={values.cost ?? undefined} errors={fe.cost} />
        </div>
      </Section>

      <Section icon={MapPin} title={mode === "edit" ? "หมายเหตุ" : "ผู้ถือครองและสถานที่เริ่มต้น"}>
        {mode === "edit" ? (
          <p className="text-sm text-muted-foreground">
            เปลี่ยนผู้ถือครอง / สถานที่ / แผนก ผ่านเมนู &quot;ส่งมอบ / คืน / ย้าย&quot; เพื่อออกเอกสารพร้อมลายเซ็นและบันทึกประวัติ
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField label="ผู้ถือครอง" name="ownerId" options={options.users} allowEmpty defaultValue={values.ownerId} errors={fe.ownerId} />
            <SelectField label="แผนก" name="departmentId" options={options.departments} allowEmpty defaultValue={values.departmentId} errors={fe.departmentId} />
            <SelectField label="สถานที่" name="locationId" options={options.locations} allowEmpty defaultValue={values.locationId} errors={fe.locationId} />
          </div>
        )}
        <TextareaField label="หมายเหตุ" name="note" defaultValue={values.note ?? undefined} rows={3} errors={fe.note} />
      </Section>

      {!state.ok && state.message && !Object.keys(fe).length && <FormMessage message={state.message} />}

      <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-2xl border border-border bg-card/90 p-3 shadow-lg backdrop-blur print:hidden">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <Link href={cancelHref}>ยกเลิก</Link>
        </Button>
        <SubmitButton pending={pending}>{mode === "edit" ? "บันทึกการแก้ไข" : mode === "bulk" ? "สร้างครุภัณฑ์" : "ลงทะเบียน"}</SubmitButton>
      </div>
    </form>
  );
}
