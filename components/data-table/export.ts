import type { ExportValue } from "./features";

export type ExportSheet = {
  headers: string[];
  rows: ExportValue[][];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportCsv(sheet: ExportSheet, filename: string) {
  const { unparse } = await import("papaparse");
  const csv = unparse({ fields: sheet.headers, data: sheet.rows.map((r) => r.map((v) => v ?? "")) });
  // BOM so Excel opens Thai text as UTF-8
  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export async function exportExcel(sheet: ExportSheet, filename: string) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(sheet.headers).font = { bold: true };
  for (const row of sheet.rows) ws.addRow(row.map((v) => v ?? ""));
  ws.columns.forEach((col, i) => {
    const longest = Math.max(sheet.headers[i]?.length ?? 0, ...sheet.rows.map((r) => String(r[i] ?? "").length));
    col.width = Math.min(Math.max(longest + 2, 10), 50);
  });
  const buffer = await wb.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}
