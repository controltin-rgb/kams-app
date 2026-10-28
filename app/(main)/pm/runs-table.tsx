"use client";

import Link from "next/link";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { PmRunStatusBadge } from "@/components/pm-badges";
import { pmRunStatusLabels } from "@/lib/labels";
import { formatDate } from "@/lib/utils/date";
import type { RunRow } from "@/modules/pm/queries";

const col = dataTableColumns<RunRow>();

const columns = col.columns([
  col.accessor("dueDate", {
    header: "กำหนด",
    cell: ({ row }) => (
      <Link href={`/pm/runs/${row.original.id}`} className="font-semibold text-primary hover:underline">
        {formatDate(row.original.dueDate)}
      </Link>
    ),
    meta: { export: (r) => formatDate(r.dueDate) },
  }),
  col.accessor("title", { header: "แผน PM", cell: ({ getValue }) => <span className="font-medium">{getValue()}</span> }),
  col.accessor("target", { header: "ครุภัณฑ์ / สถานที่", cell: ({ getValue }) => <span className="line-clamp-1 max-w-72">{getValue() || "-"}</span> }),
  col.accessor("assignedTech", { header: "ผู้รับผิดชอบ", cell: ({ getValue }) => getValue() || "-" }),
  col.accessor("status", {
    header: "สถานะ",
    filterFn: "equalsString",
    cell: ({ getValue }) => <PmRunStatusBadge status={getValue()} />,
    meta: { export: (r) => pmRunStatusLabels[r.status] },
  }),
]);

const filters: DataTableFilter[] = [
  { columnId: "status", label: "สถานะ", options: (["OVERDUE", "SCHEDULED", "IN_PROGRESS"] as const).map((s) => ({ value: s, label: pmRunStatusLabels[s] })) },
];

export function RunsTable({ rows }: { rows: RunRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      exportName="pm-runs"
      printTitle="งาน PM ที่ต้องทำ"
      searchPlaceholder="ค้นหาแผน, ครุภัณฑ์, ผู้รับผิดชอบ..."
      emptyMessage="ไม่มีงาน PM ค้าง"
    />
  );
}
