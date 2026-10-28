"use client";

import { useMemo } from "react";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { logActionLabels, logModuleLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import type { LogRow } from "@/modules/logs/queries";

const col = dataTableColumns<LogRow>();
const actionText = (a: string) => (logActionLabels[a] ? `${logActionLabels[a]} (${a})` : a);

const columns = col.columns([
  col.accessor("createdAt", {
    header: "เวลา",
    sortFn: "datetime",
    cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDateTime(getValue())}</span>,
    meta: { export: (r) => formatDateTime(r.createdAt) },
  }),
  col.accessor("user", {
    header: "ผู้ใช้",
    cell: ({ row }) => (
      <div>
        <div>{row.original.user || "-"}</div>
        {row.original.impersonatedBy && <div className="text-xs font-medium text-amber-600 dark:text-amber-400">ทำแทนโดย {row.original.impersonatedBy}</div>}
      </div>
    ),
  }),
  col.accessor("impersonatedBy", { header: "ทำแทนโดย" }),
  col.accessor("module", {
    header: "โมดูล",
    filterFn: "equalsString",
    cell: ({ getValue }) => logModuleLabels[getValue()] ?? getValue(),
    meta: { export: (r) => logModuleLabels[r.module] ?? r.module },
  }),
  col.accessor("action", {
    header: "การกระทำ",
    filterFn: "equalsString",
    cell: ({ getValue }) => <span className="whitespace-nowrap font-medium">{actionText(getValue())}</span>,
    meta: { export: (r) => actionText(r.action) },
  }),
  col.accessor("details", {
    header: "รายละเอียด",
    cell: ({ row }) =>
      row.original.details ? (
        <code title={row.original.details} className="line-clamp-2 max-w-md break-all text-xs text-muted-foreground">
          {row.original.details}
        </code>
      ) : (
        "-"
      ),
  }),
  col.accessor("entityId", { header: "รหัสอ้างอิง" }),
  col.accessor("ip", { header: "IP", cell: ({ getValue }) => getValue() || "-" }),
]);

const hidden = new Set(["impersonatedBy", "entityId"]);

export function LogsTable({ rows, exportable }: { rows: LogRow[]; exportable: boolean }) {
  // Filter options come from the rows actually loaded
  const filters = useMemo<DataTableFilter[]>(() => {
    const modules = [...new Set(rows.map((r) => r.module))].sort();
    const actions = [...new Set(rows.map((r) => r.action))].sort();
    return [
      { columnId: "module", label: "โมดูล", options: modules.map((m) => ({ value: m, label: logModuleLabels[m] ?? m })) },
      { columnId: "action", label: "การกระทำ", options: actions.map((a) => ({ value: a, label: actionText(a) })) },
    ];
  }, [rows]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      hiddenColumns={hidden}
      pageSizes={[25, 50, 100, 500]}
      exportable={exportable}
      exportName="audit-log"
      printTitle="Audit Log"
      searchPlaceholder="ค้นหาผู้ใช้, รายละเอียด, IP..."
      emptyMessage="ไม่มีบันทึกในช่วงวันที่นี้"
    />
  );
}
