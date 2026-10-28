"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Pause, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Button } from "@/components/ui/button";
import { pmFrequencyLabels } from "@/lib/labels";
import { formatDate } from "@/lib/utils/date";
import { deleteSchedule, setScheduleActive } from "@/modules/pm/actions";
import type { ScheduleRow } from "@/modules/pm/queries";

type Can = { update: boolean; delete: boolean };
const col = dataTableColumns<ScheduleRow>();

function buildColumns(can: Can) {
  return col.columns([
    col.accessor("title", {
      header: "แผน PM",
      cell: ({ row }) => (
        <Link href={`/pm/schedules/${row.original.id}`} className="font-semibold hover:text-primary hover:underline">
          {row.original.title}
        </Link>
      ),
    }),
    col.accessor("target", { header: "ครุภัณฑ์ / สถานที่", cell: ({ getValue }) => <span className="line-clamp-1 max-w-72">{getValue() || "-"}</span> }),
    col.accessor("frequency", {
      header: "ความถี่",
      filterFn: "equalsString",
      cell: ({ getValue }) => pmFrequencyLabels[getValue()],
      meta: { export: (s) => pmFrequencyLabels[s.frequency] },
    }),
    col.accessor("assignedTech", { header: "ผู้รับผิดชอบ", cell: ({ getValue }) => getValue() || "-" }),
    col.accessor("nextDueDate", { header: "รอบถัดไป", cell: ({ getValue }) => formatDate(getValue()), meta: { export: (s) => formatDate(s.nextDueDate) } }),
    col.accessor("doneCount", { header: "ทำแล้ว (ครั้ง)", meta: { align: "right" } }),
    col.accessor((s) => (s.active ? "active" : "inactive"), {
      id: "active",
      header: "สถานะ",
      filterFn: "equalsString",
      cell: ({ row }) =>
        row.original.active ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">ใช้งาน</span>
        ) : (
          <span className="text-xs text-muted-foreground">ปิดใช้</span>
        ),
      meta: { export: (s) => (s.active ? "ใช้งาน" : "ปิดใช้") },
    }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {can.update && (
            <>
              <Button asChild variant="ghost" size="icon-sm" aria-label="แก้ไข" className="rounded-lg text-muted-foreground hover:text-primary">
                <Link href={`/pm/schedules/${row.original.id}`}>
                  <Pencil />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={row.original.active ? "ปิดใช้" : "เปิดใช้"}
                className="rounded-lg text-muted-foreground hover:text-primary"
                onClick={async () => {
                  const r = await setScheduleActive(row.original.id, !row.original.active);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                }}
              >
                {row.original.active ? <Pause /> : <Play />}
              </Button>
            </>
          )}
          {can.delete && (
            <ConfirmAction
              title={`ลบแผน "${row.original.title}"?`}
              description="ลบได้เฉพาะแผนที่ยังไม่เคยทำ PM — ถ้ามีประวัติแล้วให้ปิดใช้แทน"
              onConfirm={() => deleteSchedule(row.original.id)}
              trigger={<DeleteIconButton />}
            />
          )}
        </div>
      ),
    }),
  ]);
}

const filters: DataTableFilter[] = [
  { columnId: "frequency", label: "ความถี่", options: Object.entries(pmFrequencyLabels).map(([value, label]) => ({ value, label })) },
  { columnId: "active", label: "สถานะ", options: [{ value: "active", label: "ใช้งาน" }, { value: "inactive", label: "ปิดใช้" }] },
];

export function SchedulesTable({ rows, can }: { rows: ScheduleRow[]; can: Can }) {
  const columns = useMemo(() => buildColumns(can), [can]);
  return (
    <DataTable data={rows} columns={columns} filters={filters} exportName="pm-schedules" printTitle="แผนบำรุงรักษา (PM)" searchPlaceholder="ค้นหาแผน, ครุภัณฑ์..." emptyMessage="ยังไม่มีแผน PM" />
  );
}
