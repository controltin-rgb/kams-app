"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field, SelectField } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { roleKindLabels } from "@/lib/labels";
import { createRole, deleteRole } from "@/modules/roles/actions";

export type RoleRow = { key: string; name: string; description: string; kind: keyof typeof roleKindLabels; users: number; permissions: number };
type Option = { value: string; label: string };

const kindTone: Record<RoleRow["kind"], string> = {
  locked: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  builtIn: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  customized: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  custom: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

function NewRoleDialog({ copyOptions }: { copyOptions: Option[] }) {
  const router = useRouter();
  return (
    <FormDialog
      title="เพิ่มบทบาท"
      description="สร้างแล้วจะไปหน้ากำหนดสิทธิ์ต่อ"
      trigger={
        <AddButton>
          <Plus /> เพิ่มบทบาท
        </AddButton>
      }
      action={createRole}
      onSuccess={(s) => s.data?.id && router.push(`/admin/roles/${s.data.id}`)}
    >
      {(state) => (
        <>
          <Field label="ชื่อบทบาท" name="name" required autoFocus placeholder="เช่น หัวหน้าช่าง" errors={state.fieldErrors?.name} />
          <Field label="รหัสบทบาท" name="key" required autoComplete="off" placeholder="เช่น supervisor" hint="ภาษาอังกฤษตัวเล็ก ใช้อ้างอิงในระบบ แก้ไขภายหลังไม่ได้" errors={state.fieldErrors?.key} />
          <Field label="คำอธิบาย" name="description" errors={state.fieldErrors?.description} />
          <SelectField label="คัดลอกสิทธิ์จาก" name="copyFrom" options={copyOptions} allowEmpty emptyLabel="- เริ่มจากไม่มีสิทธิ์ -" errors={state.fieldErrors?.copyFrom} />
        </>
      )}
    </FormDialog>
  );
}

const col = dataTableColumns<RoleRow>();

function buildColumns(canDelete: boolean) {
  return col.columns([
    col.accessor("name", {
      header: "บทบาท",
      cell: ({ row }) => (
        <Link href={`/admin/roles/${row.original.key}`} className="font-semibold text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    }),
    col.accessor("key", { header: "รหัส", cell: ({ getValue }) => <span className="font-mono text-sm">{getValue()}</span> }),
    col.accessor("description", { header: "คำอธิบาย", cell: ({ getValue }) => <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">{getValue() || "-"}</span> }),
    col.accessor("kind", {
      header: "ประเภท",
      filterFn: "equalsString",
      cell: ({ getValue }) => <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${kindTone[getValue()]}`}>{roleKindLabels[getValue()]}</span>,
      meta: { export: (r) => roleKindLabels[r.kind] },
    }),
    col.accessor("permissions", { header: "จำนวนสิทธิ์", meta: { align: "right" } }),
    col.accessor("users", { header: "ผู้ใช้", meta: { align: "right" } }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground hover:text-primary">
            <Link href={`/admin/roles/${row.original.key}`} aria-label="แก้ไขสิทธิ์" title="แก้ไขสิทธิ์">
              <Pencil />
            </Link>
          </Button>
          {canDelete && row.original.kind === "custom" && (
            <ConfirmAction
              title={`ลบบทบาท "${row.original.name}"?`}
              description="ลบได้เฉพาะบทบาทที่ไม่มีผู้ใช้"
              onConfirm={() => deleteRole(row.original.key)}
              trigger={<DeleteIconButton />}
            />
          )}
        </div>
      ),
    }),
  ]);
}

const filters: DataTableFilter[] = [{ columnId: "kind", label: "ประเภท", options: Object.entries(roleKindLabels).map(([value, label]) => ({ value, label })) }];

export function RolesTable({ rows, copyOptions, can }: { rows: RoleRow[]; copyOptions: Option[]; can: { create: boolean; delete: boolean } }) {
  const columns = useMemo(() => buildColumns(can.delete), [can.delete]);
  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      exportName="roles"
      printTitle="บทบาทและสิทธิ์การใช้งาน"
      searchPlaceholder="ค้นหาชื่อหรือรหัสบทบาท..."
      actions={can.create && <NewRoleDialog copyOptions={copyOptions} />}
    />
  );
}
