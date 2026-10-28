"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Play, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { TextareaField } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PmRunStatus } from "@/generated/prisma/enums";
import { completeRun, skipRun, startRun } from "@/modules/pm/actions";
import type { ChecklistItem } from "@/modules/pm/schemas";

export function RunChecklist({ runId, status, items, canExecute }: { runId: string; status: PmRunStatus; items: ChecklistItem[]; canExecute: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const set = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }));

  const submit = () =>
    startTransition(async () => {
      const r = await completeRun({ runId, results: items.map((i) => ({ itemId: i.id, value: values[i.id] ?? "" })), notes: notes || undefined });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });

  const answered = items.filter((i) => values[i.id]).length;

  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {items.map((item, n) => {
          const v = values[item.id] ?? "";
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
              <span className="w-6 text-sm font-semibold text-muted-foreground">{n + 1}.</span>
              <span className="min-w-48 flex-1 font-medium">
                {item.label}
                {item.required && <span className="text-destructive">*</span>}
              </span>
              {item.type === "CHECK" ? (
                <div className="flex gap-2" role="radiogroup" aria-label={item.label}>
                  <Button
                    type="button"
                    role="radio"
                    aria-checked={v === "pass"}
                    variant={v === "pass" ? "default" : "outline"}
                    className={`h-9 rounded-lg ${v === "pass" ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : ""}`}
                    disabled={!canExecute}
                    onClick={() => set(item.id, "pass")}
                  >
                    <Check /> ผ่าน
                  </Button>
                  <Button
                    type="button"
                    role="radio"
                    aria-checked={v === "fail"}
                    variant={v === "fail" ? "destructive" : "outline"}
                    className="h-9 rounded-lg"
                    disabled={!canExecute}
                    onClick={() => set(item.id, "fail")}
                  >
                    <X /> ไม่ผ่าน
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type={item.type === "NUMBER" ? "number" : "text"}
                    step="any"
                    value={v}
                    onChange={(e) => set(item.id, e.target.value)}
                    aria-label={item.label}
                    disabled={!canExecute}
                    className="h-9 w-48 rounded-lg"
                  />
                  {item.unit && <span className="text-sm text-muted-foreground">{item.unit}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">หมายเหตุ</span>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canExecute} className="min-h-20 rounded-xl" />
      </label>

      {canExecute && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            บันทึกแล้ว {answered}/{items.length} รายการ
          </span>
          <div className="flex flex-wrap gap-2">
            {status !== "IN_PROGRESS" && (
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await startRun(runId);
                    if (r.ok) toast.success(r.message);
                    else toast.error(r.message);
                  })
                }
              >
                <Play /> เริ่มทำ
              </Button>
            )}
            <FormDialog
              title="ข้ามงาน PM รอบนี้"
              action={skipRun}
              hidden={{ runId }}
              submitLabel="ยืนยันข้าม"
              trigger={
                <Button variant="outline" className="h-11 rounded-xl">
                  <SkipForward /> ข้าม
                </Button>
              }
            >
              {(state) => <TextareaField label="เหตุผล" name="reason" required rows={3} errors={state.fieldErrors?.reason} />}
            </FormDialog>
            <Button variant="gradient" className="h-11 rounded-xl px-5" disabled={pending} onClick={submit}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />} บันทึกผล PM
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
