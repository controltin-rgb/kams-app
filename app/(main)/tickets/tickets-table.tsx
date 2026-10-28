"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { SlaBadge, TicketPriorityBadge, TicketStatusBadge } from "@/components/ticket-badges";
import { ticketCategoryLabels, ticketPriorityLabels, ticketStatusLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import type { TicketRow } from "@/modules/tickets/queries";

const col = dataTableColumns<TicketRow>();

const columns = col.columns([
  col.accessor("ticketNumber", {
    header: "เลขที่",
    cell: ({ row }) => (
      <Link href={`/tickets/${row.original.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
        {row.original.ticketNumber}
      </Link>
    ),
  }),
  col.accessor("title", {
    header: "หัวข้อ",
    cell: ({ row }) => (
      <div className="min-w-56 max-w-96">
        <div className="line-clamp-1 font-semibold">{row.original.title}</div>
        {row.original.asset && <div className="line-clamp-1 text-xs text-muted-foreground">{row.original.asset}</div>}
      </div>
    ),
  }),
  col.accessor("asset", { header: "ครุภัณฑ์" }),
  col.accessor("category", {
    header: "หมวด",
    filterFn: "equalsString",
    cell: ({ getValue }) => ticketCategoryLabels[getValue()],
    meta: { export: (t) => ticketCategoryLabels[t.category] },
  }),
  col.accessor("priority", {
    header: "ความเร่งด่วน",
    filterFn: "equalsString",
    cell: ({ getValue }) => <TicketPriorityBadge priority={getValue()} />,
    meta: { export: (t) => ticketPriorityLabels[t.priority] },
  }),
  col.accessor("status", {
    header: "สถานะ",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        <TicketStatusBadge status={row.original.status} />
        <SlaBadge state={row.original.sla} />
      </div>
    ),
    meta: { export: (t) => ticketStatusLabels[t.status] },
  }),
  col.accessor("reporter", { header: "ผู้แจ้ง" }),
  col.accessor("assignedTech", {
    header: "ผู้รับผิดชอบ",
    cell: ({ getValue }) => getValue() || <span className="text-muted-foreground">ยังไม่มอบหมาย</span>,
  }),
  col.accessor("dueAt", {
    header: "กำหนดเสร็จ",
    sortUndefined: "last",
    cell: ({ getValue }) => formatDateTime(getValue()),
    meta: { export: (t) => formatDateTime(t.dueAt, "") },
  }),
  col.accessor("createdAt", {
    header: "แจ้งเมื่อ",
    cell: ({ getValue }) => formatDateTime(getValue()),
    meta: { export: (t) => formatDateTime(t.createdAt) },
  }),
]);

const filters: DataTableFilter[] = [
  { columnId: "status", label: "สถานะ", options: Object.entries(ticketStatusLabels).map(([value, label]) => ({ value, label })) },
  { columnId: "priority", label: "ความเร่งด่วน", options: Object.entries(ticketPriorityLabels).map(([value, label]) => ({ value, label })) },
  { columnId: "category", label: "หมวด", options: Object.entries(ticketCategoryLabels).map(([value, label]) => ({ value, label })) },
];

const hidden = new Set(["asset"]);

const views = [
  { key: "active", label: "งานที่ยังไม่ปิด", match: (t: TicketRow) => !["CLOSED", "CANCELLED"].includes(t.status) },
  { key: "mine", label: "ฉันแจ้ง", match: (t: TicketRow) => t.mine },
  { key: "assigned", label: "มอบหมายให้ฉัน", match: (t: TicketRow) => t.assignedToMe },
  { key: "all", label: "ทั้งหมด", match: () => true },
] as const;

export function TicketsTable({ rows }: { rows: TicketRow[] }) {
  const [view, setView] = useState<(typeof views)[number]["key"]>("active");
  const current = views.find((v) => v.key === view) ?? views[0];
  const data = rows.filter(current.match);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden" role="tablist" aria-label="มุมมอง">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              view === v.key ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label} <span className="ml-1 opacity-70">{rows.filter(v.match).length}</span>
          </button>
        ))}
      </div>
      <DataTable
        key={view}
        data={data}
        columns={columns}
        hiddenColumns={hidden}
        filters={filters}
        pageSizes={[25, 50, 100]}
        exportName="tickets"
        printTitle="รายการแจ้งซ่อม"
        searchPlaceholder="ค้นหาเลขที่, หัวข้อ, ครุภัณฑ์, ผู้แจ้ง..."
        emptyMessage="ไม่มีงานแจ้งซ่อม"
      />
    </div>
  );
}
