"use client";

import Link from "next/link";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { ClaimStatusBadge } from "@/components/pm-badges";
import { claimStatusLabels } from "@/lib/labels";
import { formatDate } from "@/lib/utils/date";
import type { ClaimRow } from "@/modules/claims/queries";

const col = dataTableColumns<ClaimRow>();

const columns = col.columns([
  col.accessor("claimNumber", {
    header: "เลขที่เคลม",
    cell: ({ row }) => (
      <Link href={`/claims/${row.original.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
        {row.original.claimNumber}
      </Link>
    ),
  }),
  col.accessor("asset", { header: "ครุภัณฑ์", cell: ({ getValue }) => <span className="line-clamp-1 max-w-72">{getValue()}</span> }),
  col.accessor("vendor", { header: "ผู้ขาย/ศูนย์บริการ" }),
  col.accessor("status", {
    header: "สถานะ",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <ClaimStatusBadge status={row.original.status} />
        {row.original.late && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">เกินกำหนดรับคืน</span>}
      </div>
    ),
    meta: { export: (c) => claimStatusLabels[c.status] },
  }),
  col.accessor("sentDate", { header: "วันที่ส่ง", cell: ({ getValue }) => formatDate(getValue()), meta: { export: (c) => formatDate(c.sentDate) } }),
  col.accessor("expectedReturnDate", { header: "คาดว่าได้คืน", cell: ({ getValue }) => formatDate(getValue()), meta: { export: (c) => formatDate(c.expectedReturnDate, "") } }),
  col.accessor("actualReturnDate", { header: "รับคืนจริง", cell: ({ getValue }) => formatDate(getValue()), meta: { export: (c) => formatDate(c.actualReturnDate, "") } }),
  col.accessor("ticketNumber", { header: "งานซ่อม", cell: ({ getValue }) => getValue() || "-" }),
]);

const filters: DataTableFilter[] = [{ columnId: "status", label: "สถานะ", options: Object.entries(claimStatusLabels).map(([value, label]) => ({ value, label })) }];

export function ClaimsTable({ rows }: { rows: ClaimRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      pageSizes={[25, 50, 100]}
      exportName="claims"
      printTitle="รายการส่งเคลม"
      searchPlaceholder="ค้นหาเลขที่, ครุภัณฑ์, ผู้ขาย..."
      emptyMessage="ยังไม่มีรายการเคลม"
    />
  );
}
