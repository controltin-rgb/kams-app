"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton, EditIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { CheckboxField, Field, SelectField, TextareaField } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import { propertyTypeLabels } from "@/lib/labels";
import type { CrudFlags } from "@/lib/permissions-server";
import { deletePropertyDef, savePropertyDef } from "@/modules/master/actions";
import type { PropertyDefRow } from "@/modules/master/queries";
import { propertyTypes } from "@/modules/master/schemas";

const typeOptions = propertyTypes.map((t) => ({ value: t, label: propertyTypeLabels[t] }));

function PropertyFields({ row, nextOrder, state }: { row?: PropertyDefRow; nextOrder: number; state: { fieldErrors?: Partial<Record<string, string[]>> } }) {
  const [type, setType] = useState<string>(row?.type ?? "TEXT");
  const fe = state.fieldErrors ?? {};
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ชื่อที่แสดง" name="label" defaultValue={row?.label} required autoFocus errors={fe.label} />
        <Field
          label="Key"
          name="key"
          defaultValue={row?.key}
          required
          className="font-mono"
          hint="ใช้อ้างอิงในระบบ/ไฟล์นำเข้า เช่น ram_gb"
          errors={fe.key}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <SelectField label="ชนิดข้อมูล" name="type" options={typeOptions} defaultValue={type} onValueChange={setType} required errors={fe.type} />
        <Field label="ลำดับ" name="sortOrder" type="number" min={0} max={999} defaultValue={row?.sortOrder ?? nextOrder} errors={fe.sortOrder} />
      </div>
      {type === "SELECT" && (
        <TextareaField
          label="ตัวเลือก"
          name="options"
          defaultValue={row?.options.join("\n")}
          rows={4}
          hint="หนึ่งตัวเลือกต่อบรรทัด"
          errors={fe.options}
        />
      )}
      <CheckboxField label="บังคับกรอก" name="required" defaultChecked={row?.required} />
    </>
  );
}

function PropertyDialog({ categoryId, row, nextOrder, trigger }: { categoryId: string; row?: PropertyDefRow; nextOrder: number; trigger: ReactNode }) {
  return (
    <FormDialog
      title={row ? "แก้ไข property" : "เพิ่ม property"}
      trigger={trigger}
      action={savePropertyDef}
      hidden={{ categoryId, ...(row ? { id: row.id } : {}) }}
    >
      {(state) => <PropertyFields row={row} nextOrder={nextOrder} state={state} />}
    </FormDialog>
  );
}

const col = dataTableColumns<PropertyDefRow>();

function buildColumns(can: CrudFlags, categoryId: string, nextOrder: number) {
  return col.columns([
    col.accessor("sortOrder", { header: "ลำดับ", meta: { align: "center" } }),
    col.accessor("label", { header: "ชื่อที่แสดง", cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span> }),
    col.accessor("key", { header: "Key", cell: ({ getValue }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{getValue()}</code> }),
    col.accessor("type", {
      header: "ชนิด",
      cell: ({ getValue }) => propertyTypeLabels[getValue()],
      meta: { export: (p) => propertyTypeLabels[p.type] },
    }),
    col.accessor((p) => p.options.join(", "), {
      id: "options",
      header: "ตัวเลือก",
      cell: ({ getValue }) => <span className="line-clamp-1 max-w-64 text-muted-foreground">{getValue() || "-"}</span>,
    }),
    col.accessor("required", {
      header: "บังคับ",
      meta: { align: "center", export: (p) => (p.required ? "ใช่" : "") },
      cell: ({ getValue }) => (getValue() ? <span className="font-semibold text-primary">✓</span> : <span className="text-muted-foreground">-</span>),
    }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) =>
        can.update && (
          <div className="flex justify-end gap-1">
            <PropertyDialog categoryId={categoryId} row={row.original} nextOrder={nextOrder} trigger={<EditIconButton />} />
            <ConfirmAction
              title={`ลบ property "${row.original.label}"?`}
              description="ค่าที่บันทึกไว้ในครุภัณฑ์เดิมจะยังเก็บไว้ แต่จะไม่แสดงในฟอร์มอีก"
              onConfirm={() => deletePropertyDef(row.original.id)}
              trigger={<DeleteIconButton />}
            />
          </div>
        ),
    }),
  ]);
}

export function PropertiesTable({ categoryId, rows, can }: { categoryId: string; rows: PropertyDefRow[]; can: CrudFlags }) {
  const nextOrder = rows.length ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 0;
  const columns = useMemo(() => buildColumns(can, categoryId, nextOrder), [can, categoryId, nextOrder]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="asset-properties"
      printTitle="Property ของประเภทครุภัณฑ์"
      searchPlaceholder="ค้นหา property..."
      emptyMessage="ยังไม่มี property — เพิ่มเพื่อให้ฟอร์มครุภัณฑ์มีช่องกรอกเฉพาะประเภทนี้"
      actions={
        can.update && (
          <PropertyDialog
            categoryId={categoryId}
            nextOrder={nextOrder}
            trigger={
              <AddButton>
                <Plus /> เพิ่ม property
              </AddButton>
            }
          />
        )
      }
    />
  );
}
