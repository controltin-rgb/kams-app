"use client";

import Link from "next/link";
import { AssetStatusBadge } from "@/components/asset-status-badge";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { assetConditionLabels, assetStatusLabels } from "@/lib/labels";
import { formatDate } from "@/lib/utils/date";
import type { AssetRow } from "@/modules/assets/queries";

const col = dataTableColumns<AssetRow>();

const columns = col.columns([
  col.accessor("assetCode", {
    header: "รหัสครุภัณฑ์",
    cell: ({ row }) => (
      <Link href={`/assets/${row.original.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
        {row.original.assetCode}
      </Link>
    ),
  }),
  col.accessor("name", {
    header: "ชื่อ",
    cell: ({ row }) => (
      <div className="min-w-48">
        <div className="font-semibold">{row.original.name}</div>
        {(row.original.brand || row.original.model) && (
          <div className="text-xs text-muted-foreground">{[row.original.brand, row.original.model].filter(Boolean).join(" ")}</div>
        )}
      </div>
    ),
  }),
  col.accessor("brand", { header: "ยี่ห้อ", meta: { export: (a) => a.brand } }),
  col.accessor("model", { header: "รุ่น", meta: { export: (a) => a.model } }),
  col.accessor("serialNumber", { header: "Serial", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() || "-"}</span> }),
  col.accessor("category", { header: "ประเภท", filterFn: "equalsString" }),
  col.accessor("status", {
    header: "สถานะ",
    filterFn: "equalsString",
    cell: ({ getValue }) => <AssetStatusBadge status={getValue()} />,
    meta: { export: (a) => assetStatusLabels[a.status] },
  }),
  col.accessor("condition", {
    header: "สภาพ",
    filterFn: "equalsString",
    cell: ({ getValue }) => assetConditionLabels[getValue()],
    meta: { export: (a) => assetConditionLabels[a.condition] },
  }),
  col.accessor("owner", { header: "ผู้ถือครอง", cell: ({ getValue }) => getValue() || "-" }),
  col.accessor("department", { header: "แผนก", cell: ({ getValue }) => getValue() || "-" }),
  col.accessor("location", {
    header: "สถานที่",
    cell: ({ getValue }) => <span className="line-clamp-2 max-w-56 text-sm">{getValue() || "-"}</span>,
  }),
  col.accessor("warrantyExpiry", {
    header: "หมดประกัน",
    sortFn: "alphanumeric",
    sortUndefined: "last",
    cell: ({ getValue }) => {
      const v = getValue();
      if (!v) return "-";
      const expired = new Date(v) < new Date();
      return <span className={expired ? "text-destructive" : ""}>{formatDate(v)}</span>;
    },
    meta: { export: (a) => formatDate(a.warrantyExpiry, "") },
  }),
]);

/** Columns hidden on screen (only used for search/export) */
const hiddenOnScreen = new Set(["brand", "model"]);

export function AssetsTable({ rows, categories, actions }: { rows: AssetRow[]; categories: string[]; actions?: React.ReactNode }) {
  const filters: DataTableFilter[] = [
    { columnId: "category", label: "ประเภท", options: categories.map((c) => ({ value: c, label: c })) },
    { columnId: "status", label: "สถานะ", options: Object.entries(assetStatusLabels).map(([value, label]) => ({ value, label })) },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      hiddenColumns={hiddenOnScreen}
      filters={filters}
      pageSizes={[25, 50, 100]}
      exportName="assets"
      printTitle="ทะเบียนครุภัณฑ์"
      searchPlaceholder="ค้นหารหัส, ชื่อ, ยี่ห้อ, Serial, ผู้ถือครอง..."
      emptyMessage="ยังไม่มีครุภัณฑ์"
      actions={actions}
    />
  );
}
