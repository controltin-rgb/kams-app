"use client";

import { useMemo, type ReactNode } from "react";
import { CornerDownRight, Plus } from "lucide-react";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton, EditIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field, SelectField } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { locationTypeLabels, locationTypeOrder } from "@/lib/labels";
import type { CrudFlags } from "@/lib/permissions-server";
import { deleteLocation, saveLocation } from "@/modules/master/actions";
import type { LocationNode } from "@/modules/master/queries";

const typeOptions = locationTypeOrder.map((t) => ({ value: t, label: locationTypeLabels[t] }));

function nextLevel(type?: LocationNode["type"]) {
  if (!type) return "BUILDING";
  return locationTypeOrder[Math.min(locationTypeOrder.indexOf(type) + 1, locationTypeOrder.length - 1)];
}

type Option = { value: string; label: string };

function LocationDialog({
  row,
  parent,
  all,
  sceneSlots,
  trigger,
}: {
  row?: LocationNode;
  /** Preselected parent when adding a child */
  parent?: LocationNode;
  all: LocationNode[];
  /** 3D Office slots; only passed to users who may configure the scene */
  sceneSlots?: Option[];
  trigger: ReactNode;
}) {
  // A node cannot be moved under itself or its descendants; SPOT cannot have children
  const parentOptions = all
    .filter((l) => l.type !== "SPOT" && !row?.subtreeIds.includes(l.id))
    .map((l) => ({ value: l.id, label: `${l.path} (${locationTypeLabels[l.type]})` }));

  return (
    <FormDialog
      title={row ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}
      trigger={trigger}
      action={saveLocation}
      hidden={row ? { id: row.id } : undefined}
    >
      {(state) => (
        <>
          <SelectField
            label="อยู่ภายใต้"
            name="parentId"
            options={parentOptions}
            defaultValue={row?.parentId ?? parent?.id}
            allowEmpty
            emptyLabel="- ระดับบนสุด -"
            errors={state.fieldErrors?.parentId}
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <SelectField
              label="ระดับ"
              name="type"
              options={typeOptions}
              defaultValue={row?.type ?? nextLevel(parent?.type)}
              required
              errors={state.fieldErrors?.type}
            />
            <Field label="ชื่อ" name="name" defaultValue={row?.name} required autoFocus errors={state.fieldErrors?.name} />
          </div>
          {sceneSlots && (
            <SelectField
              label="ตำแหน่งใน 3D Office"
              name="sceneSlot"
              options={sceneSlots}
              defaultValue={row?.sceneSlot}
              allowEmpty
              emptyLabel="- ไม่แสดงในฉาก -"
              hint="ครุภัณฑ์ของสถานที่นี้จะแสดงไฟสถานะที่โต๊ะ/จุดนี้"
              errors={state.fieldErrors?.sceneSlot}
            />
          )}
        </>
      )}
    </FormDialog>
  );
}

const col = dataTableColumns<LocationNode>();

function buildColumns(can: CrudFlags, all: LocationNode[], sceneSlots?: Option[]) {
  const slotLabel = new Map(sceneSlots?.map((s) => [s.value, s.label]));
  return col.columns([
    col.accessor("path", {
      header: "สถานที่",
      cell: ({ row }) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.original.depth * 1.25}rem` }}>
          {row.original.depth > 0 && <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />}
          <div>
            <div className="font-semibold">{row.original.name}</div>
            {row.original.depth > 0 && <div className="text-xs text-muted-foreground">{row.original.path}</div>}
          </div>
        </div>
      ),
    }),
    col.accessor("type", {
      header: "ระดับ",
      filterFn: "equalsString",
      cell: ({ getValue }) => (
        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{locationTypeLabels[getValue()]}</span>
      ),
      meta: { export: (l) => locationTypeLabels[l.type] },
    }),
    col.accessor("children", { header: "สถานที่ย่อย", meta: { align: "right" } }),
    col.accessor("assets", { header: "ครุภัณฑ์", meta: { align: "right" } }),
    ...(sceneSlots
      ? [
          col.accessor("sceneSlot", {
            header: "3D Office",
            cell: ({ getValue }) => {
              const v = getValue();
              return v ? <span className="text-xs">{slotLabel.get(v) ?? v}</span> : <span className="text-muted-foreground">-</span>;
            },
            meta: { export: (l) => (l.sceneSlot ? (slotLabel.get(l.sceneSlot) ?? l.sceneSlot) : "") },
          }),
        ]
      : []),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can.create && row.original.type !== "SPOT" && (
            <LocationDialog
              parent={row.original}
              all={all}
              sceneSlots={sceneSlots}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="เพิ่มสถานที่ย่อย" className="rounded-lg text-muted-foreground hover:text-primary">
                  <Plus />
                </Button>
              }
            />
          )}
          {can.update && <LocationDialog row={row.original} all={all} sceneSlots={sceneSlots} trigger={<EditIconButton />} />}
          {can.delete && (
            <ConfirmAction
              title={`ลบ "${row.original.name}"?`}
              description="ลบได้เฉพาะสถานที่ที่ไม่มีสถานที่ย่อยและครุภัณฑ์"
              onConfirm={() => deleteLocation(row.original.id)}
              trigger={<DeleteIconButton />}
            />
          )}
        </div>
      ),
    }),
  ]);
}

const filters: DataTableFilter[] = [{ columnId: "type", label: "ระดับ", options: typeOptions }];

export function LocationsTable({ rows, can, sceneSlots }: { rows: LocationNode[]; can: CrudFlags; sceneSlots?: Option[] }) {
  const columns = useMemo(() => buildColumns(can, rows, sceneSlots), [can, rows, sceneSlots]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      pageSizes={[50, 100, 200]}
      exportName="locations"
      printTitle="รายการสถานที่"
      searchPlaceholder="ค้นหาสถานที่..."
      actions={
        can.create && (
          <LocationDialog
            all={rows}
            sceneSlots={sceneSlots}
            trigger={
              <AddButton>
                <Plus /> เพิ่มสถานที่
              </AddButton>
            }
          />
        )
      }
    />
  );
}
