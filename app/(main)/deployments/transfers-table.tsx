"use client";

import Link from "next/link";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { transferTypeLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import type { TransferRow } from "@/modules/deployments/queries";

const col = dataTableColumns<TransferRow>();

const columns = col.columns([
  col.accessor("docNumber", {
    header: "เลขที่เอกสาร",
    cell: ({ row }) => (
      <Link href={`/deployments/${row.original.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
        {row.original.docNumber}
      </Link>
    ),
  }),
  col.accessor("type", {
    header: "ประเภท",
    filterFn: "equalsString",
    cell: ({ getValue }) => <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{transferTypeLabels[getValue()]}</span>,
    meta: { export: (t) => transferTypeLabels[t.type] },
  }),
  col.accessor("assets", {
    header: "ครุภัณฑ์",
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-72 font-mono text-xs">
        {row.original.assets}
        {row.original.itemCount > 1 && <span className="ml-1 font-sans text-muted-foreground">({row.original.itemCount} รายการ)</span>}
      </span>
    ),
  }),
  col.accessor("toOwner", { header: "ผู้รับ", cell: ({ getValue }) => getValue() || "-" }),
  col.accessor("toLocation", { header: "สถานที่", cell: ({ getValue }) => <span className="line-clamp-1 max-w-56">{getValue() || "-"}</span> }),
  col.accessor("ticketNumber", { header: "งานซ่อม", cell: ({ getValue }) => getValue() || "-" }),
  col.accessor("signed", {
    header: "ลายเซ็น",
    cell: ({ getValue }) =>
      getValue() ? (
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">ลงนามแล้ว</span>
      ) : (
        <span className="text-xs text-amber-600 dark:text-amber-400">รอลงนาม</span>
      ),
    meta: { export: (t) => (t.signed ? "ลงนามแล้ว" : "รอลงนาม") },
  }),
  col.accessor("performedBy", { header: "ผู้ทำรายการ" }),
  col.accessor("createdAt", {
    header: "วันที่",
    cell: ({ getValue }) => formatDateTime(getValue()),
    meta: { export: (t) => formatDateTime(t.createdAt) },
  }),
]);

const filters: DataTableFilter[] = [
  { columnId: "type", label: "ประเภท", options: Object.entries(transferTypeLabels).map(([value, label]) => ({ value, label })) },
];

export function TransfersTable({ rows }: { rows: TransferRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      pageSizes={[25, 50, 100]}
      exportName="asset-transfers"
      printTitle="เอกสารส่งมอบ / ย้าย / เปลี่ยนเครื่อง"
      searchPlaceholder="ค้นหาเลขที่, รหัสครุภัณฑ์, ผู้รับ..."
      emptyMessage="ยังไม่มีเอกสาร"
    />
  );
}
