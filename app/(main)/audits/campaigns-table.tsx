"use client";

import Link from "next/link";
import { CampaignStatusBadge } from "@/components/audit-badges";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { campaignStatusLabels } from "@/lib/labels";
import { formatDate } from "@/lib/utils/date";
import type { CampaignRow } from "@/modules/audits/queries";

const col = dataTableColumns<CampaignRow>();

const columns = col.columns([
  col.accessor("title", {
    header: "รอบตรวจนับ",
    cell: ({ row }) => (
      <Link href={`/audits/${row.original.id}`} className="font-semibold text-primary hover:underline">
        {row.original.title}
      </Link>
    ),
  }),
  col.accessor("year", { header: "ปี", cell: ({ getValue }) => getValue() + 543, meta: { export: (c) => String(c.year + 543) } }),
  col.accessor("status", {
    header: "สถานะ",
    filterFn: "equalsString",
    cell: ({ row }) => <CampaignStatusBadge status={row.original.status} />,
    meta: { export: (c) => campaignStatusLabels[c.status] },
  }),
  col.accessor("startDate", { header: "เริ่ม", cell: ({ getValue }) => formatDate(getValue()), meta: { export: (c) => formatDate(c.startDate) } }),
  col.accessor("endDate", { header: "สิ้นสุด", cell: ({ getValue }) => formatDate(getValue()), meta: { export: (c) => formatDate(c.endDate) } }),
  col.accessor("records", { header: "รายการผล", meta: { align: "right" } }),
  col.accessor("auditors", { header: "ผู้ตรวจนับ", meta: { align: "right" } }),
]);

const filters: DataTableFilter[] = [{ columnId: "status", label: "สถานะ", options: Object.entries(campaignStatusLabels).map(([value, label]) => ({ value, label })) }];

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      pageSizes={[25, 50, 100]}
      exportName="stock-take-campaigns"
      printTitle="รอบตรวจนับครุภัณฑ์"
      searchPlaceholder="ค้นหาชื่อรอบ..."
      emptyMessage="ยังไม่มีรอบตรวจนับ"
    />
  );
}
