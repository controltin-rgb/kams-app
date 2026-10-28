"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { CheckboxField, Field, SelectField, SubmitButton, TextareaField } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { ticketCategoryLabels, ticketPriorityLabels } from "@/lib/labels";
import { createTicket } from "@/modules/tickets/actions";
import { ACCEPT, uploadFiles } from "../upload-files";

type Option = { value: string; label: string };

const categoryOptions = Object.entries(ticketCategoryLabels).map(([value, label]) => ({ value, label }));

export function TicketForm({
  assets,
  defaultAssetId,
  fromQr,
  sla,
}: {
  assets: Option[];
  defaultAssetId?: string;
  fromQr: boolean;
  sla: Record<keyof typeof ticketPriorityLabels, number>;
}) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(createTicket);
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fe = state.fieldErrors ?? {};

  const priorityOptions = (Object.keys(ticketPriorityLabels) as (keyof typeof ticketPriorityLabels)[]).map((p) => ({
    value: p,
    label: `${ticketPriorityLabels[p]} (ภายใน ${sla[p]} ชม.)`,
  }));

  useEffect(() => {
    if (!state.ok || !state.data?.id) {
      if (state.message && !state.fieldErrors) toast.error(state.message);
      return;
    }
    const id = state.data.id;
    (async () => {
      if (files.length) {
        setUploading(true);
        await uploadFiles(id, files);
      }
      toast.success(state.message);
      router.push(`/tickets/${id}`);
    })();
    // Run once per successful submission
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {fromQr && <input type="hidden" name="fromQr" value="true" />}
      <section className="animate-fade-up space-y-4 rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 sm:p-7">
        <Field label="หัวข้อปัญหา" name="title" required placeholder="เช่น เครื่องพิมพ์ไม่ดึงกระดาษ" errors={fe.title} />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="หมวด" name="category" options={categoryOptions} defaultValue="IT" required errors={fe.category} />
          <SelectField label="ความเร่งด่วน" name="priority" options={priorityOptions} defaultValue="MEDIUM" required errors={fe.priority} />
        </div>
        <SelectField
          label="ครุภัณฑ์ที่เกี่ยวข้อง"
          name="assetId"
          options={assets}
          allowEmpty
          emptyLabel="- ไม่ระบุ (เช่น งานอาคาร) -"
          defaultValue={defaultAssetId}
          onValueChange={(v) => setAssetId(v === "__none__" ? "" : v)}
          hint={assets.length === 0 ? "ไม่มีครุภัณฑ์ในความดูแลของคุณ" : undefined}
          errors={fe.assetId}
        />
        {assetId && (
          <CheckboxField
            label="ครุภัณฑ์ใช้งานไม่ได้"
            name="assetUnusable"
            hint="สถานะครุภัณฑ์จะเปลี่ยนเป็น 'ระหว่างซ่อม' จนกว่างานจะปิด แล้วคืนสถานะเดิมอัตโนมัติ"
          />
        )}
        <Field label="สถานที่ / จุดที่พบปัญหา" name="locationText" placeholder="เช่น อาคาร A ชั้น 2 ห้อง 201" errors={fe.locationText} />
        <TextareaField label="รายละเอียด" name="description" rows={5} placeholder="อาการ เกิดขึ้นเมื่อไร ลองแก้อะไรไปแล้วบ้าง" errors={fe.description} />

        <div className="space-y-2">
          <p className="text-sm font-semibold">รูปภาพ / ไฟล์แนบ</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-5 text-sm text-muted-foreground transition hover:border-primary hover:bg-accent/40">
            <Paperclip className="size-4" /> เลือกไฟล์ (รูปภาพหรือ PDF ไม่เกิน 10 MB ต่อไฟล์)
            <input
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 10));
                e.target.value = "";
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate">{f.name}</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`เอา ${f.name} ออก`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" className="h-11 rounded-xl px-5">
          <Link href="/tickets">ยกเลิก</Link>
        </Button>
        <SubmitButton pending={pending || uploading}>{uploading ? "กำลังอัปโหลดไฟล์..." : "ส่งเรื่องแจ้งซ่อม"}</SubmitButton>
      </div>
    </form>
  );
}
