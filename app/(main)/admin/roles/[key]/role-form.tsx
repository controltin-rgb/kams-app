"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field, FormMessage, SubmitButton } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { actionLabels, resourceLabels } from "@/lib/labels";
import type { PermissionMap } from "@/lib/permissions";
import { resetRole, updateRole } from "@/modules/roles/actions";

type Props = {
  role: { key: string; name: string; description: string; permissions: PermissionMap; builtIn: boolean; customized: boolean };
  matrix: { resource: string; actions: string[] }[];
  lockedReason: string | null;
  canReset: boolean;
};

function ActionCheck({ name, label, checked, disabled, onChange }: { name: string; label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  const id = `${name}-${useId()}`;
  return (
    <span className="inline-flex items-center gap-2">
      <Checkbox id={id} name={name} value="true" checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </span>
  );
}

export function RoleForm({ role, matrix, lockedReason, canReset }: Props) {
  const router = useRouter();
  const locked = !!lockedReason;
  const [granted, setGranted] = useState<Record<string, string[]>>(() => Object.fromEntries(matrix.map((m) => [m.resource, role.permissions[m.resource as keyof PermissionMap] ?? []])));
  const { state, onSubmit, pending } = useFormAction(updateRole, (s) => {
    toast.success(s.message);
    router.refresh();
  });

  const toggle = (resource: string, action: string, on: boolean) =>
    setGranted((g) => {
      const cur = new Set(g[resource]);
      if (on) {
        cur.add(action);
        for (const base of ["view", "list"]) cur.add(base); // filtered to the row's actions below
      }
      else cur.delete(action);
      // Any other action needs "view"/"list" to reach the page, so unticking it clears the row
      if (!on && (action === "view" || action === "list")) cur.clear();
      return { ...g, [resource]: matrix.find((m) => m.resource === resource)!.actions.filter((a) => cur.has(a)) };
    });
  const setRow = (resource: string, all: boolean) => setGranted((g) => ({ ...g, [resource]: all ? [...matrix.find((m) => m.resource === resource)!.actions] : [] }));

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="key" value={role.key} />
      {lockedReason && (
        <p role="note" className="flex items-center gap-2 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <Lock className="size-4 shrink-0" /> {lockedReason}
        </p>
      )}

      <section className="animate-fade-up grid gap-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:grid-cols-2 sm:p-7">
        <Field label="ชื่อบทบาท" name="name" defaultValue={role.name} required disabled={locked} errors={state.fieldErrors?.name} />
        <Field label="คำอธิบาย" name="description" defaultValue={role.description} disabled={locked} errors={state.fieldErrors?.description} />
      </section>

      <section className="animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 [animation-delay:80ms] sm:p-7">
        <h2 className="mb-1 text-lg font-semibold">สิทธิ์การใช้งาน</h2>
        <p className="mb-4 text-sm text-muted-foreground">เลือกสิทธิ์อื่นแล้วระบบจะให้สิทธิ์ &quot;ดู&quot; อัตโนมัติ · การเข้าใช้งานแทน (Impersonate) สงวนไว้สำหรับผู้ดูแลระบบ</p>
        <div className="divide-y divide-border">
          {matrix.map(({ resource, actions }) => {
            const row = granted[resource] ?? [];
            return (
              <div key={resource} className="grid gap-3 py-4 md:grid-cols-[13rem_1fr_auto] md:items-center">
                <div className="font-medium">{resourceLabels[resource] ?? resource}</div>
                <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label={resourceLabels[resource] ?? resource}>
                  {actions.map((a) => (
                    <ActionCheck key={a} name={`perm.${resource}.${a}`} label={actionLabels[a] ?? a} checked={row.includes(a)} disabled={locked} onChange={(v) => toggle(resource, a, v)} />
                  ))}
                </div>
                {!locked && (
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setRow(resource, true)} aria-label={`เลือกทั้งหมด: ${resourceLabels[resource] ?? resource}`}>
                      ทั้งหมด
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg text-muted-foreground" onClick={() => setRow(resource, false)} aria-label={`ล้าง: ${resourceLabels[resource] ?? resource}`}>
                      ล้าง
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <Link href="/admin/roles">กลับ</Link>
        </Button>
        {canReset && (
          <ConfirmAction
            title="คืนค่าสิทธิ์เริ่มต้น?"
            description="สิทธิ์ที่แก้ไขไว้จะถูกแทนที่ด้วยค่าเริ่มต้นของระบบ"
            confirmLabel="คืนค่าเริ่มต้น"
            variant="default"
            onConfirm={() => resetRole(role.key)}
            onSuccess={() => window.location.reload()}
            trigger={
              <Button type="button" variant="outline" className="h-11 rounded-xl px-5">
                <RotateCcw /> คืนค่าเริ่มต้น
              </Button>
            }
          />
        )}
        {!locked && <SubmitButton pending={pending}>บันทึกสิทธิ์</SubmitButton>}
      </div>
    </form>
  );
}
