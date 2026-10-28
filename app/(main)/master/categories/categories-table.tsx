"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListTree, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton, EditIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field, SelectField, TextareaField } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { office3dModelLabels } from "@/lib/labels";
import type { CrudFlags } from "@/lib/permissions-server";
import { deleteCategory, saveCategory } from "@/modules/master/actions";
import type { CategoryRow } from "@/modules/master/queries";
import { ASSET_MODELS } from "@/modules/office3d/models";

const sceneModelOptions = ASSET_MODELS.filter((m) => m !== "generic_equipment").map((m) => ({ value: m, label: office3dModelLabels[m] ?? m }));

export function CategoryDialog({
  row,
  trigger,
  onCreated,
  sceneModels,
}: {
  row?: Pick<CategoryRow, "id" | "name" | "codePrefix" | "description" | "sceneModel" | "assets">;
  trigger: ReactNode;
  onCreated?: (id: string) => void;
  /** Show the 3D Office model choice (office3d.configureLayout) */
  sceneModels?: boolean;
}) {
  return (
    <FormDialog
      title={row ? "แก้ไขประเภทครุภัณฑ์" : "เพิ่มประเภทครุภัณฑ์"}
      trigger={trigger}
      action={saveCategory}
      hidden={row ? { id: row.id } : undefined}
      onSuccess={(state) => !row && state.data?.id && onCreated?.(state.data.id)}
    >
      {(state) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="ชื่อประเภท" name="name" defaultValue={row?.name} required autoFocus errors={state.fieldErrors?.name} />
            <Field
              label="รหัสนำหน้า"
              name="codePrefix"
              defaultValue={row?.codePrefix}
              required
              maxLength={6}
              className="uppercase"
              disabled={!!row && row.assets > 0}
              hint={row && row.assets > 0 ? "ล็อกแล้ว (มีครุภัณฑ์)" : "เช่น PC → PC-2026-0001"}
              errors={state.fieldErrors?.codePrefix}
            />
          </div>
          {/* disabled inputs are not submitted — keep the current prefix */}
          {row && row.assets > 0 && <input type="hidden" name="codePrefix" value={row.codePrefix} />}
          <TextareaField label="คำอธิบาย" name="description" defaultValue={row?.description} rows={2} errors={state.fieldErrors?.description} />
          {sceneModels && (
            <SelectField
              label="โมเดลใน 3D Office"
              name="sceneModel"
              options={sceneModelOptions}
              defaultValue={row?.sceneModel}
              allowEmpty
              emptyLabel="- อุปกรณ์ทั่วไป -"
              errors={state.fieldErrors?.sceneModel}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

const col = dataTableColumns<CategoryRow>();

function buildColumns(can: CrudFlags, sceneModels: boolean) {
  return col.columns([
    col.accessor("codePrefix", {
      header: "รหัสนำหน้า",
      cell: ({ getValue }) => <span className="rounded-lg bg-accent px-2.5 py-1 font-mono text-xs font-bold text-accent-foreground">{getValue()}</span>,
    }),
    col.accessor("name", {
      header: "ชื่อประเภท",
      cell: ({ row }) => (
        <Link href={`/master/categories/${row.original.id}`} className="font-semibold hover:text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    }),
    col.accessor("description", {
      header: "คำอธิบาย",
      cell: ({ getValue }) => <span className="line-clamp-1 max-w-72 text-muted-foreground">{getValue() || "-"}</span>,
    }),
    col.accessor("properties", { header: "Property", meta: { align: "right" } }),
    col.accessor("assets", { header: "ครุภัณฑ์", meta: { align: "right" } }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label="กำหนด property" className="rounded-lg text-muted-foreground hover:text-primary">
            <Link href={`/master/categories/${row.original.id}`}>
              <ListTree />
            </Link>
          </Button>
          {can.update && <CategoryDialog row={row.original} sceneModels={sceneModels} trigger={<EditIconButton />} />}
          {can.delete && (
            <ConfirmAction
              title={`ลบประเภท "${row.original.name}"?`}
              description="ลบได้เฉพาะประเภทที่ยังไม่มีครุภัณฑ์ (property ที่กำหนดไว้จะถูกลบด้วย)"
              onConfirm={() => deleteCategory(row.original.id)}
              trigger={<DeleteIconButton />}
            />
          )}
        </div>
      ),
    }),
  ]);
}

export function CategoriesTable({ rows, can, sceneModels = false }: { rows: CategoryRow[]; can: CrudFlags; sceneModels?: boolean }) {
  const router = useRouter();
  const columns = useMemo(() => buildColumns(can, sceneModels), [can, sceneModels]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="asset-categories"
      printTitle="ประเภทครุภัณฑ์"
      searchPlaceholder="ค้นหาชื่อหรือรหัสนำหน้า..."
      actions={
        can.create && (
          <CategoryDialog
            sceneModels={sceneModels}
            onCreated={(id) => router.push(`/master/categories/${id}`)}
            trigger={
              <AddButton>
                <Plus /> เพิ่มประเภท
              </AddButton>
            }
          />
        )
      }
    />
  );
}
