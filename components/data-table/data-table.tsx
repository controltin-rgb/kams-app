"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTable, type RowData } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  Printer,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dataTableFeatures, type DataTableColumn, type ExportValue } from "./features";
import { exportCsv, exportExcel, type ExportSheet } from "./export";

export type DataTableFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

type DataTableProps<TData extends RowData> = {
  data: TData[];
  columns: DataTableColumn<TData>[];
  /** Base filename for CSV/Excel export (without extension) */
  exportName: string;
  /** Title shown on the printed page */
  printTitle?: string;
  searchPlaceholder?: string;
  filters?: DataTableFilter[];
  /** Extra controls on the right of the toolbar (e.g. "Add" button) */
  actions?: ReactNode;
  pageSizes?: number[];
  emptyMessage?: string;
  /** Column ids used for search/export only (not rendered on screen or in print) */
  hiddenColumns?: ReadonlySet<string>;
  /** Show CSV/Excel/print buttons (default true); turn off when the viewer lacks the export permission */
  exportable?: boolean;
};

// Radix Select cannot use "" as an item value
const ALL = "__all__";

const alignClass = (align?: "left" | "right" | "center") =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "";

/**
 * Standard list table: global search, select filters, sorting, pagination, CSV/Excel export and print.
 * Export and print use every row matching the current search/filters/sort, not just the visible page.
 */
export function DataTable<TData extends RowData>({
  data,
  columns,
  exportName,
  printTitle,
  searchPlaceholder = "ค้นหา...",
  filters = [],
  actions,
  pageSizes = [10, 25, 50, 100],
  emptyMessage = "ไม่พบข้อมูล",
  hiddenColumns,
  exportable = true,
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize: pageSizes[0] } },
  });
  const [printing, setPrinting] = useState(false);

  const { globalFilter, columnFilters, pagination } = table.state;
  const filteredRows = table.getPrePaginatedRowModel().rows;
  const leafColumns = table.getAllLeafColumns();
  const hasActiveFilters = !!globalFilter || columnFilters.length > 0;

  const exportColumns = useMemo(
    () => leafColumns.filter((c) => c.columnDef.meta?.export !== false && (c.accessorFn || c.columnDef.meta?.export)),
    [leafColumns],
  );

  const buildSheet = (): ExportSheet => ({
    headers: exportColumns.map((c) => {
      const header = c.columnDef.header;
      return c.columnDef.meta?.label ?? (typeof header === "string" ? header : c.id);
    }),
    rows: filteredRows.map((row) =>
      exportColumns.map((c) => {
        const custom = c.columnDef.meta?.export;
        if (typeof custom === "function") return custom(row.original);
        const value = row.getValue(c.id);
        if (value instanceof Date) return value.toISOString();
        return typeof value === "string" || typeof value === "number" ? value : value == null ? "" : String(value as ExportValue);
      }),
    ),
  });

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  const from = filteredRows.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredRows.length);

  const renderHead = (sortable: boolean) => (
    <TableHeader>
      {table.getHeaderGroups().map((group) => (
        <TableRow key={group.id} className="hover:bg-transparent">
          {group.headers.filter((h) => !hiddenColumns?.has(h.column.id)).map((header) => {
            const sorted = header.column.getIsSorted();
            return (
              <TableHead
                key={header.id}
                aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                className={`h-12 px-4 font-semibold text-muted-foreground ${alignClass(header.column.columnDef.meta?.align)}`}
              >
                {header.isPlaceholder ? null : sortable && header.column.getCanSort() ? (
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className="inline-flex items-center gap-1.5 transition hover:text-foreground"
                  >
                    <table.FlexRender header={header} />
                    {sorted === "asc" ? (
                      <ArrowUp className="size-3.5 text-primary" />
                    ) : sorted === "desc" ? (
                      <ArrowDown className="size-3.5 text-primary" />
                    ) : (
                      <ArrowUpDown className="size-3.5 opacity-40" />
                    )}
                  </button>
                ) : (
                  <table.FlexRender header={header} />
                )}
              </TableHead>
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
  );

  const renderRows = (rows: typeof filteredRows) =>
    rows.map((row) => (
      <TableRow key={row.id} className="hover:bg-primary/3">
        {row.getAllCells().filter((c) => !hiddenColumns?.has(c.column.id)).map((cell) => (
          <TableCell key={cell.id} className={`px-4 py-3 ${alignClass(cell.column.columnDef.meta?.align)}`}>
            <table.FlexRender cell={cell} />
          </TableCell>
        ))}
      </TableRow>
    ));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="ค้นหา"
              value={String(globalFilter ?? "")}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 rounded-xl pl-9"
            />
          </div>
          {filters.map((f) => {
            const column = table.getColumn(f.columnId);
            if (!column) return null;
            return (
              <div key={f.columnId} className="flex items-center gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">{f.label}</span>
                <Select
                  value={String(column.getFilterValue() ?? ALL)}
                  onValueChange={(v) => column.setFilterValue(v === ALL ? undefined : v)}
                >
                  <SelectTrigger aria-label={f.label} className="h-10! min-w-36 flex-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={ALL}>ทั้งหมด</SelectItem>
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              className="h-10 rounded-xl text-muted-foreground"
              onClick={() => {
                table.resetGlobalFilter(true);
                table.resetColumnFilters(true);
              }}
            >
              <X /> ล้างตัวกรอง
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportable && (
            <>
              <Button variant="outline" className="h-10 rounded-xl px-3" disabled={!filteredRows.length} onClick={() => exportCsv(buildSheet(), exportName)}>
                <Download /> CSV
              </Button>
              <Button variant="outline" className="h-10 rounded-xl px-3" disabled={!filteredRows.length} onClick={() => exportExcel(buildSheet(), exportName)}>
                <FileSpreadsheet /> Excel
              </Button>
              <Button variant="outline" className="h-10 rounded-xl px-3" disabled={!filteredRows.length} onClick={() => setPrinting(true)}>
                <Printer /> พิมพ์
              </Button>
            </>
          )}
          {actions}
        </div>
      </div>

      {/* Screen table (current page) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card print:hidden">
        <Table className="min-w-max">
          {renderHead(true)}
          <TableBody>
            {table.getRowModel().rows.length ? (
              renderRows(table.getRowModel().rows)
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={leafColumns.length - (hiddenColumns?.size ?? 0)} className="py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Print table (all matching rows) — rendered only while printing */}
      {printing && (
        <div className="hidden print:block">
          {printTitle && <h1 className="mb-3 text-lg font-semibold">{printTitle}</h1>}
          <Table className="text-xs [&_td]:border [&_td]:border-black/20 [&_th]:border [&_th]:border-black/20">
            {renderHead(false)}
            <TableBody>{renderRows(filteredRows)}</TableBody>
          </Table>
          <p className="mt-2 text-xs">ทั้งหมด {filteredRows.length} รายการ</p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground print:hidden sm:flex-row">
        <div className="flex items-center gap-3">
          <span>
            {from}-{to} จาก {filteredRows.length} รายการ
            {hasActiveFilters && data.length !== filteredRows.length && ` (ทั้งหมด ${data.length})`}
          </span>
          <Select value={String(pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger aria-label="จำนวนต่อหน้า" className="h-9! rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {pageSizes.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / หน้า
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-lg" aria-label="หน้าแรก" onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon-lg" aria-label="หน้าก่อน" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft />
          </Button>
          <span className="px-2 text-foreground">
            หน้า {table.getPageCount() === 0 ? 0 : pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button variant="outline" size="icon-lg" aria-label="หน้าถัดไป" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon-lg" aria-label="หน้าสุดท้าย" onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
