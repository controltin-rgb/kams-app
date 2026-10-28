"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Lock, Paperclip, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { CheckboxField, Field, SelectField, SubmitButton, TextareaField } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import type { TicketStatus } from "@/generated/prisma/enums";
import type { FormState } from "@/lib/form-state";
import { ticketPriorityLabels, ticketStatusLabels } from "@/lib/labels";
import {
  addComment,
  addPart,
  assignTicket,
  changePriority,
  changeStatus,
  deleteAttachment,
  removePart,
  saveRepairInfo,
} from "@/modules/tickets/actions";
import { ACCEPT, uploadFiles } from "../upload-files";

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Toast the result of an inline (non-dialog) form */
function useResultToast(state: FormState<object>, onOk?: () => void) {
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onOk?.();
    } else if (state.message && !state.fieldErrors) toast.error(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

// ---------- Status ----------

const statusButton: Partial<Record<TicketStatus, { label: string; variant: "gradient" | "outline" | "destructive" }>> = {
  IN_PROGRESS: { label: "เริ่มดำเนินการ", variant: "gradient" },
  ON_HOLD: { label: "พักไว้ / รอชิ้นส่วน", variant: "outline" },
  RESOLVED: { label: "แก้ไขเสร็จ", variant: "gradient" },
  CLOSED: { label: "ปิดงาน", variant: "gradient" },
  CANCELLED: { label: "ยกเลิกงาน", variant: "destructive" },
};

export function StatusActions({ ticketId, current, next, resolution }: { ticketId: string; current: TicketStatus; next: TicketStatus[]; resolution: string | null }) {
  if (!next.length) return <p className="text-sm text-muted-foreground">ไม่มีการดำเนินการที่ทำได้</p>;
  return (
    <div className="flex flex-col gap-2">
      {next.map((to) => {
        const cfg = statusButton[to] ?? { label: ticketStatusLabels[to], variant: "outline" as const };
        const label = to === "IN_PROGRESS" && current === "RESOLVED" ? "เปิดงานใหม่ (ยังไม่หาย)" : to === "IN_PROGRESS" && current === "ON_HOLD" ? "ดำเนินการต่อ" : cfg.label;
        return (
          <FormDialog
            key={to}
            title={label}
            description={`เปลี่ยนสถานะเป็น "${ticketStatusLabels[to]}"`}
            action={changeStatus}
            hidden={{ ticketId, status: to }}
            submitLabel="ยืนยัน"
            trigger={
              <Button variant={cfg.variant} className="h-11 w-full rounded-xl">
                {label}
              </Button>
            }
          >
            {(state) =>
              to === "RESOLVED" ? (
                <TextareaField label="วิธีแก้ไข" name="resolution" required rows={4} defaultValue={resolution ?? ""} errors={state.fieldErrors?.resolution} />
              ) : (
                <TextareaField
                  label={to === "CANCELLED" ? "เหตุผลที่ยกเลิก" : "หมายเหตุ (ไม่บังคับ)"}
                  name="note"
                  required={to === "CANCELLED"}
                  rows={3}
                  errors={state.fieldErrors?.note}
                />
              )
            }
          </FormDialog>
        );
      })}
    </div>
  );
}

// ---------- Assign / priority ----------

export function AssignForm({ ticketId, current, techs }: { ticketId: string; current: string | null; techs: { value: string; label: string }[] }) {
  const { state, onSubmit, pending } = useFormAction(assignTicket);
  useResultToast(state);
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <SelectField
        label="ผู้รับผิดชอบ"
        name="assignedTechId"
        options={techs}
        allowEmpty
        emptyLabel="- ยังไม่มอบหมาย -"
        defaultValue={current}
        className="flex-1"
        errors={state.fieldErrors?.assignedTechId as string[] | undefined}
      />
      <Button type="submit" variant="outline" disabled={pending} className="h-12 rounded-xl">
        {pending ? <Loader2 className="animate-spin" /> : "มอบหมาย"}
      </Button>
    </form>
  );
}

export function PriorityForm({ ticketId, current }: { ticketId: string; current: keyof typeof ticketPriorityLabels }) {
  const { state, onSubmit, pending } = useFormAction(changePriority);
  useResultToast(state);
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <SelectField
        label="ความเร่งด่วน"
        name="priority"
        options={Object.entries(ticketPriorityLabels).map(([value, label]) => ({ value, label }))}
        defaultValue={current}
        className="flex-1"
      />
      <Button type="submit" variant="outline" disabled={pending} className="h-12 rounded-xl">
        {pending ? <Loader2 className="animate-spin" /> : "เปลี่ยน"}
      </Button>
    </form>
  );
}

// ---------- Comments ----------

export function CommentBox({ ticketId, canInternal }: { ticketId: string; canInternal: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [key, setKey] = useState(0);
  const { state, onSubmit, pending } = useFormAction(addComment);
  useResultToast(state, () => setKey((k) => k + 1));
  return (
    <form key={key} ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <TextareaField label="เพิ่มความเห็น" name="body" rows={3} placeholder="พิมพ์ข้อความถึงผู้แจ้ง/ผู้รับผิดชอบ..." errors={state.fieldErrors?.body} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canInternal ? <CheckboxField label="โน้ตภายใน (ผู้แจ้งไม่เห็น)" name="internal" /> : <span />}
        <Button type="submit" variant="gradient" disabled={pending} className="h-10 rounded-xl px-4">
          {pending ? <Loader2 className="animate-spin" /> : <Send />} ส่ง
        </Button>
      </div>
    </form>
  );
}

// ---------- Repair info & parts ----------

export function RepairInfoForm({ ticketId, cause, resolution, laborCost }: { ticketId: string; cause: string | null; resolution: string | null; laborCost: string }) {
  const { state, onSubmit, pending } = useFormAction(saveRepairInfo);
  useResultToast(state);
  const fe = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <TextareaField label="สาเหตุ" name="cause" rows={3} defaultValue={cause ?? ""} errors={fe.cause} />
      <TextareaField label="วิธีแก้ไข" name="resolution" rows={3} defaultValue={resolution ?? ""} errors={fe.resolution} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label="ค่าแรง/ค่าบริการ (บาท)" name="laborCost" inputMode="decimal" defaultValue={laborCost} className="w-56" errors={fe.laborCost} />
        <SubmitButton pending={pending}>บันทึกข้อมูลการซ่อม</SubmitButton>
      </div>
    </form>
  );
}

type Part = { id: string; name: string; qty: number; unitCost: string; total: string };

export function PartsPanel({ ticketId, parts, laborCost, repairCost, canEdit }: { ticketId: string; parts: Part[]; laborCost: string; repairCost: string; canEdit: boolean }) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-120 text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">รายการ</th>
              <th className="px-3 py-2 text-right font-semibold">จำนวน</th>
              <th className="px-3 py-2 text-right font-semibold">ราคา/หน่วย</th>
              <th className="px-3 py-2 text-right font-semibold">รวม</th>
              {canEdit && <th className="w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                  ยังไม่มีรายการอะไหล่
                </td>
              </tr>
            )}
            {parts.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-right">{p.qty}</td>
                <td className="px-3 py-2 text-right">{money.format(Number(p.unitCost))}</td>
                <td className="px-3 py-2 text-right font-medium">{money.format(Number(p.total))}</td>
                {canEdit && (
                  <td className="px-1">
                    <ConfirmAction
                      title={`ลบ "${p.name}"?`}
                      onConfirm={() => removePart(p.id)}
                      onSuccess={() => router.refresh()}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`ลบ ${p.name}`} className="text-muted-foreground hover:text-destructive">
                          <Trash2 />
                        </Button>
                      }
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">
                ค่าแรง/ค่าบริการ
              </td>
              <td className="px-3 py-2 text-right">{money.format(Number(laborCost))}</td>
              {canEdit && <td />}
            </tr>
            <tr>
              <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                รวมค่าซ่อม
              </td>
              <td className="px-3 py-2 text-right text-base font-bold text-primary">{money.format(Number(repairCost))}</td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      {canEdit && (
        <FormDialog
          title="เพิ่มอะไหล่/วัสดุ"
          action={addPart}
          hidden={{ ticketId }}
          trigger={
            <Button variant="outline" className="h-10 rounded-xl">
              <Plus /> เพิ่มอะไหล่
            </Button>
          }
        >
          {(state) => (
            <>
              <Field label="ชื่ออะไหล่/วัสดุ" name="name" required autoFocus errors={state.fieldErrors?.name} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="จำนวน" name="qty" type="number" min={1} defaultValue={1} required errors={state.fieldErrors?.qty} />
                <Field label="ราคาต่อหน่วย (บาท)" name="unitCost" inputMode="decimal" required errors={state.fieldErrors?.unitCost} />
              </div>
            </>
          )}
        </FormDialog>
      )}
    </div>
  );
}

// ---------- Attachments ----------

type AttachmentRow = { id: string; filename: string; mime: string; size: number; uploadedById: string | null };

export function AttachmentsPanel({
  ticketId,
  attachments,
  canAttach,
  canManage,
  userId,
}: {
  ticketId: string;
  attachments: AttachmentRow[];
  canAttach: boolean;
  canManage: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {attachments.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีไฟล์แนบ</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {attachments.map((a) => (
          <div key={a.id} className="group relative overflow-hidden rounded-2xl border border-border bg-muted/30">
            <a href={`/api/files/${a.id}`} target="_blank" rel="noreferrer" className="block">
              {a.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by our authorised file route
                <img src={`/api/files/${a.id}`} alt={a.filename} className="aspect-4/3 w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex aspect-4/3 items-center justify-center">
                  <FileText className="size-10 text-muted-foreground" />
                </div>
              )}
              <p className="truncate px-2 py-1.5 text-xs">{a.filename}</p>
            </a>
            {(canManage || (canAttach && a.uploadedById === userId)) && (
              <ConfirmAction
                title={`ลบไฟล์ "${a.filename}"?`}
                onConfirm={() => deleteAttachment(a.id)}
                onSuccess={() => router.refresh()}
                trigger={
                  <Button
                    variant="destructive"
                    size="icon-xs"
                    aria-label={`ลบ ${a.filename}`}
                    className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 />
                  </Button>
                }
              />
            )}
          </div>
        ))}
      </div>
      {canAttach && (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground transition hover:border-primary hover:bg-accent/40">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {pending ? "กำลังอัปโหลด..." : "แนบรูปภาพหรือ PDF (ไม่เกิน 10 MB)"}
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!files.length) return;
              startTransition(async () => {
                const ok = await uploadFiles(ticketId, files);
                if (ok) toast.success(`อัปโหลด ${ok} ไฟล์แล้ว`);
                router.refresh();
              });
            }}
          />
        </label>
      )}
    </div>
  );
}

export function InternalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      <Lock className="size-3" /> ภายใน
    </span>
  );
}
