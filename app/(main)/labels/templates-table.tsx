"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field, SelectField } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import type { CrudFlags } from "@/lib/permissions-server";
import { createTemplate, deleteTemplate, duplicateTemplate, setDefaultTemplate } from "@/modules/labels/actions";
import { paperPresets } from "@/modules/labels/design";
import type { TemplateRow } from "@/modules/labels/queries";

const kindLabels = { ASSET: "ฉลากครุภัณฑ์", STATUS: "ฉลากสถานะ" } as const;
const col = dataTableColumns<TemplateRow>();

function buildColumns(can: CrudFlags, router: ReturnType<typeof useRouter>) {
  return col.columns([
    col.accessor("name", {
      header: "ชื่อแม่แบบ",
      cell: ({ row }) => (
        <Link href={`/labels/${row.original.id}`} className="font-semibold hover:text-primary hover:underline">
          {row.original.name}
          {row.original.isDefault && <Star className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-400" aria-label="ค่าเริ่มต้น" />}
        </Link>
      ),
    }),
    col.accessor("kind", {
      header: "ชนิด",
      filterFn: "equalsString",
      cell: ({ getValue }) => <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{kindLabels[getValue()]}</span>,
      meta: { export: (t) => kindLabels[t.kind] },
    }),
    col.accessor("paper", { header: "กระดาษ" }),
    col.accessor("size", { header: "ขนาดฉลาก" }),
    col.accessor("perSheet", { header: "ดวง/แผ่น", meta: { align: "right" } }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label="ออกแบบ" className="rounded-lg text-muted-foreground hover:text-primary">
            <Link href={`/labels/${row.original.id}`}>
              <Pencil />
            </Link>
          </Button>
          {can.create && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="ทำสำเนา"
              className="rounded-lg text-muted-foreground hover:text-primary"
              onClick={async () => {
                const r = await duplicateTemplate(row.original.id);
                if (r.ok && r.data?.id) {
                  toast.success(r.message);
                  router.push(`/labels/${r.data.id}`);
                } else toast.error(r.message);
              }}
            >
              <Copy />
            </Button>
          )}
          {can.update && !row.original.isDefault && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="ตั้งเป็นค่าเริ่มต้น"
              className="rounded-lg text-muted-foreground hover:text-amber-500"
              onClick={async () => {
                const r = await setDefaultTemplate(row.original.id);
                if (r.ok) toast.success(r.message);
                else toast.error(r.message);
              }}
            >
              <Star />
            </Button>
          )}
          {can.delete && !row.original.isDefault && (
            <ConfirmAction title={`ลบแม่แบบ "${row.original.name}"?`} onConfirm={() => deleteTemplate(row.original.id)} trigger={<DeleteIconButton />} />
          )}
        </div>
      ),
    }),
  ]);
}

const filters: DataTableFilter[] = [{ columnId: "kind", label: "ชนิด", options: Object.entries(kindLabels).map(([value, label]) => ({ value, label })) }];

export function TemplatesTable({ rows, can }: { rows: TemplateRow[]; can: CrudFlags }) {
  const router = useRouter();
  const columns = useMemo(() => buildColumns(can, router), [can, router]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      exportName="label-templates"
      printTitle="แม่แบบฉลาก"
      searchPlaceholder="ค้นหาแม่แบบ..."
      actions={
        can.create && (
          <FormDialog
            title="สร้างแม่แบบฉลาก"
            action={createTemplate}
            onSuccess={(s) => s.data?.id && router.push(`/labels/${s.data.id}`)}
            trigger={
              <AddButton>
                <Plus /> สร้างแม่แบบ
              </AddButton>
            }
          >
            {(state) => (
              <>
                <Field label="ชื่อแม่แบบ" name="name" required autoFocus errors={state.fieldErrors?.name} />
                <SelectField
                  label="ชนิด"
                  name="kind"
                  options={Object.entries(kindLabels).map(([value, label]) => ({ value, label }))}
                  defaultValue="ASSET"
                  required
                  hint="ฉลากครุภัณฑ์ดึงรหัส/บาร์โค้ด/QR จากเครื่อง ส่วนฉลากสถานะเป็นข้อความคงที่"
                />
                <SelectField
                  label="กระดาษ"
                  name="paperPreset"
                  options={Object.entries(paperPresets).map(([value, p]) => ({ value, label: p.label }))}
                  defaultValue="A4_4x10"
                  required
                />
              </>
            )}
          </FormDialog>
        )
      }
    />
  );
}
