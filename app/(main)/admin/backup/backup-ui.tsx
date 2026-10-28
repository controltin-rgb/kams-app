"use client";

import { useMemo, useTransition } from "react";
import { DatabaseBackup, Download, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { CheckboxField, Field, FormMessage, SubmitButton } from "@/components/forms/field";
import { FormDialog } from "@/components/forms/form-dialog";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { backupKindLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import { deleteBackup, restoreFromBackup, runBackup, saveBackupSettings } from "@/modules/backup/actions";
import type { BackupFile } from "@/modules/backup/service";

const sizeText = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);

export function RunBackupButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="gradient"
      className="h-10 rounded-xl px-4"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runBackup();
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <DatabaseBackup />} สำรองข้อมูลตอนนี้
    </Button>
  );
}

function RestoreDialog({ file, database }: { file: BackupFile; database: string }) {
  return (
    <FormDialog
      title="กู้คืนข้อมูลจากไฟล์นี้?"
      description={`ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วย ${file.name} (${formatDateTime(file.createdAt)}) ระบบจะสำรองข้อมูลปัจจุบันไว้ก่อนอัตโนมัติ และผู้ใช้อาจต้องเข้าสู่ระบบใหม่`}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="กู้คืน" title="กู้คืน" className="rounded-lg text-muted-foreground hover:text-primary">
          <RotateCcw />
        </Button>
      }
      action={restoreFromBackup}
      hidden={{ name: file.name }}
      submitLabel="กู้คืนข้อมูล"
      onSuccess={() => {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the whole database changed; drop every cached route
        window.location.href = "/admin/backup";
      }}
    >
      {(state) => (
        <Field
          label={`พิมพ์ชื่อฐานข้อมูล "${database}" เพื่อยืนยัน`}
          name="confirm"
          required
          autoComplete="off"
          errors={state.fieldErrors?.confirm}
        />
      )}
    </FormDialog>
  );
}

const col = dataTableColumns<BackupFile>();

function buildColumns(canRun: boolean, canRestore: boolean, database: string) {
  return col.columns([
    col.accessor("name", { header: "ไฟล์", cell: ({ getValue }) => <span className="font-mono text-sm">{getValue()}</span> }),
    col.accessor("kind", {
      header: "ประเภท",
      filterFn: "equalsString",
      cell: ({ getValue }) => backupKindLabels[getValue()],
      meta: { export: (b) => backupKindLabels[b.kind] },
    }),
    col.accessor("size", { header: "ขนาด", cell: ({ getValue }) => sizeText(getValue()), meta: { align: "right", export: (b) => sizeText(b.size) } }),
    col.accessor("createdAt", { header: "สร้างเมื่อ", sortFn: "datetime", cell: ({ getValue }) => formatDateTime(getValue()), meta: { export: (b) => formatDateTime(b.createdAt) } }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-0.5">
          {canRun && (
            <Button asChild variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-primary">
              <a href={`/api/backups/${row.original.name}`} download aria-label="ดาวน์โหลด" title="ดาวน์โหลด">
                <Download />
              </a>
            </Button>
          )}
          {canRestore && <RestoreDialog file={row.original} database={database} />}
          {canRun && <ConfirmAction title={`ลบไฟล์ ${row.original.name}?`} onConfirm={() => deleteBackup(row.original.name)} trigger={<DeleteIconButton />} />}
        </div>
      ),
    }),
  ]);
}

const filters: DataTableFilter[] = [{ columnId: "kind", label: "ประเภท", options: Object.entries(backupKindLabels).map(([value, label]) => ({ value, label })) }];

export function BackupsTable({ rows, canRun, canRestore, database }: { rows: BackupFile[]; canRun: boolean; canRestore: boolean; database: string }) {
  const columns = useMemo(() => buildColumns(canRun, canRestore, database), [canRun, canRestore, database]);
  return <DataTable data={rows} columns={columns} filters={filters} exportName="backups" printTitle="ไฟล์สำรองข้อมูล" searchPlaceholder="ค้นหาชื่อไฟล์..." emptyMessage="ยังไม่มีไฟล์สำรองข้อมูล" />;
}

export function BackupSettingsForm({ autoEnabled, keep, disabled }: { autoEnabled: boolean; keep: number; disabled: boolean }) {
  const { state, onSubmit, pending } = useFormAction(saveBackupSettings, (s) => toast.success(s.message));
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4">
        <CheckboxField label="สำรองข้อมูลอัตโนมัติรายวัน" name="autoEnabled" defaultChecked={autoEnabled} hint="ทำงานเมื่อ scheduler เรียก /api/cron/backup" />
        <Field label="เก็บไฟล์ล่าสุด (ไฟล์)" name="keep" type="number" min={1} max={365} defaultValue={keep} required errors={state.fieldErrors?.keep} hint="ไฟล์ที่เก่ากว่าจะถูกลบเมื่อสำรองข้อมูลครั้งถัดไป" />
        {!state.ok && !state.fieldErrors && <FormMessage message={state.message} />}
        <SubmitButton pending={pending}>บันทึก</SubmitButton>
      </fieldset>
    </form>
  );
}
