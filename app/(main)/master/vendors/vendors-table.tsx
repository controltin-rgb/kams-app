"use client";

import { useMemo, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton, EditIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field, TextareaField } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import type { CrudFlags } from "@/lib/permissions-server";
import { deleteVendor, saveVendor } from "@/modules/master/actions";
import type { VendorRow } from "@/modules/master/queries";

function VendorDialog({ row, trigger }: { row?: VendorRow; trigger: ReactNode }) {
  return (
    <FormDialog
      title={row ? "แก้ไขผู้ขาย" : "เพิ่มผู้ขาย"}
      trigger={trigger}
      action={saveVendor}
      hidden={row ? { id: row.id } : undefined}
      className="sm:max-w-2xl"
    >
      {(state) => (
        <>
          <Field label="ชื่อบริษัท/ร้าน" name="name" defaultValue={row?.name} required autoFocus errors={state.fieldErrors?.name} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="ผู้ติดต่อ" name="contact" defaultValue={row?.contact} errors={state.fieldErrors?.contact} />
            <Field label="โทรศัพท์" name="phone" type="tel" defaultValue={row?.phone} errors={state.fieldErrors?.phone} />
            <Field label="อีเมล" name="email" type="email" defaultValue={row?.email} errors={state.fieldErrors?.email} />
          </div>
          <TextareaField label="ที่อยู่" name="address" defaultValue={row?.address} rows={2} errors={state.fieldErrors?.address} />
          <TextareaField label="หมายเหตุ" name="note" defaultValue={row?.note} rows={2} errors={state.fieldErrors?.note} />
        </>
      )}
    </FormDialog>
  );
}

const col = dataTableColumns<VendorRow>();

function buildColumns(can: CrudFlags) {
  return col.columns([
    col.accessor("name", { header: "ชื่อ", cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span> }),
    col.accessor("contact", { header: "ผู้ติดต่อ", cell: ({ getValue }) => getValue() || "-" }),
    col.accessor("phone", { header: "โทรศัพท์", cell: ({ getValue }) => getValue() || "-" }),
    col.accessor("email", { header: "อีเมล", cell: ({ getValue }) => getValue() || "-" }),
    col.accessor("note", {
      header: "หมายเหตุ",
      cell: ({ getValue }) => <span className="line-clamp-1 max-w-64 text-muted-foreground">{getValue() || "-"}</span>,
    }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can.update && <VendorDialog row={row.original} trigger={<EditIconButton />} />}
          {can.delete && (
            <ConfirmAction
              title={`ลบผู้ขาย "${row.original.name}"?`}
              description="ข้อมูลจะถูกซ่อน (soft delete) ประวัติการเคลมที่อ้างถึงยังคงอยู่"
              onConfirm={() => deleteVendor(row.original.id)}
              trigger={<DeleteIconButton />}
            />
          )}
        </div>
      ),
    }),
  ]);
}

export function VendorsTable({ rows, can }: { rows: VendorRow[]; can: CrudFlags }) {
  const columns = useMemo(() => buildColumns(can), [can]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="vendors"
      printTitle="รายชื่อผู้ขาย/ผู้ให้บริการ"
      searchPlaceholder="ค้นหาชื่อ, ผู้ติดต่อ, โทรศัพท์..."
      actions={
        can.create && (
          <VendorDialog
            trigger={
              <AddButton>
                <Plus /> เพิ่มผู้ขาย
              </AddButton>
            }
          />
        )
      }
    />
  );
}
