"use client";

import { useMemo, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton, EditIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import type { CrudFlags } from "@/lib/permissions-server";
import { deleteDepartment, saveDepartment } from "@/modules/master/actions";
import type { DepartmentRow } from "@/modules/master/queries";

function DepartmentDialog({ row, trigger }: { row?: DepartmentRow; trigger: ReactNode }) {
  return (
    <FormDialog title={row ? "แก้ไขแผนก" : "เพิ่มแผนก"} trigger={trigger} action={saveDepartment} hidden={row ? { id: row.id } : undefined}>
      {(state) => (
        <>
          <Field label="ชื่อแผนก" name="name" defaultValue={row?.name} required autoFocus errors={state.fieldErrors?.name} />
          <Field label="รหัสแผนก" name="code" defaultValue={row?.code} hint="ไม่บังคับ" errors={state.fieldErrors?.code} />
        </>
      )}
    </FormDialog>
  );
}

const col = dataTableColumns<DepartmentRow>();

function buildColumns(can: CrudFlags) {
  return col.columns([
    col.accessor("name", { header: "ชื่อแผนก", cell: ({ getValue }) => <span className="font-semibold">{getValue()}</span> }),
    col.accessor("code", { header: "รหัส", cell: ({ getValue }) => getValue() || "-" }),
    col.accessor("users", { header: "ผู้ใช้", meta: { align: "right" } }),
    col.accessor("assets", { header: "ครุภัณฑ์", meta: { align: "right" } }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can.update && <DepartmentDialog row={row.original} trigger={<EditIconButton />} />}
          {can.delete && (
            <ConfirmAction
              title={`ลบแผนก "${row.original.name}"?`}
              description="ลบได้เฉพาะแผนกที่ไม่มีผู้ใช้และครุภัณฑ์"
              onConfirm={() => deleteDepartment(row.original.id)}
              trigger={<DeleteIconButton />}
            />
          )}
        </div>
      ),
    }),
  ]);
}

export function DepartmentsTable({ rows, can }: { rows: DepartmentRow[]; can: CrudFlags }) {
  // Columns must stay stable between renders (TanStack Table v9)
  const columns = useMemo(() => buildColumns(can), [can]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="departments"
      printTitle="รายชื่อแผนก"
      searchPlaceholder="ค้นหาชื่อหรือรหัสแผนก..."
      actions={
        can.create && (
          <DepartmentDialog
            trigger={
              <AddButton>
                <Plus /> เพิ่มแผนก
              </AddButton>
            }
          />
        )
      }
    />
  );
}
