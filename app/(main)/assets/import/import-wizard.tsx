"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SelectField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { commitImport, previewImport, type ImportPreview } from "@/modules/assets/actions";
import {
  headerText,
  importColumnsFor,
  keyFromHeader,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ImportColumn,
} from "@/modules/assets/import-columns";
import type { AssetFormOptions } from "@/modules/assets/queries";

type Row = Record<string, string>;

function Step({ n, title, active, done, children }: { n: number; title: string; active: boolean; done: boolean; children: React.ReactNode }) {
  return (
    <section className={`animate-fade-up rounded-[28px] bg-card p-5 shadow-sm shadow-black/4 transition-opacity sm:p-7 ${active || done ? "" : "opacity-50"}`}>
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span
          className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? <CheckCircle2 className="size-4" /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    // exceljs rich text / hyperlink / formula cells
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return cellText(v.result);
  }
  return String(value).trim();
}

async function parseFile(file: File): Promise<Row[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    const { parse } = await import("papaparse");
    const text = await file.text();
    const result = parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy" });
    return result.data.map((r) => Object.fromEntries(Object.entries(r).map(([h, v]) => [keyFromHeader(h), String(v ?? "").trim()])));
  }
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => (headers[col] = keyFromHeader(cellText(cell.value))));
  const rows: Row[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const r: Row = {};
    row.eachCell((cell, col) => {
      if (headers[col]) r[headers[col]] = cellText(cell.value);
    });
    if (Object.values(r).some(Boolean)) rows.push(r);
  });
  return rows;
}

async function downloadTemplate(columns: ImportColumn[], categoryName: string, prefix: string) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet("ข้อมูล");
  const header = ws.addRow(columns.map(headerText));
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE7FD" } };
  ws.columns.forEach((c, i) => (c.width = Math.max(headerText(columns[i]).length + 4, 14)));
  // Treat every cell as text so codes like 0012 keep their zeros
  ws.columns.forEach((c) => (c.numFmt = "@"));

  const help = wb.addWorksheet("คำอธิบาย");
  help.addRow(["คอลัมน์", "บังคับ", "รูปแบบ/ตัวเลือก"]).font = { bold: true };
  for (const c of columns) help.addRow([headerText(c), c.required ? "ใช่" : "", c.hint ?? ""]);
  help.columns.forEach((c) => (c.width = 40));

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `import-template-${prefix}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`ดาวน์โหลดแม่แบบ ${categoryName} แล้ว`);
}

export function ImportWizard({ categories }: { categories: AssetFormOptions["categories"] }) {
  const [categoryId, setCategoryId] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const category = categories.find((c) => c.id === categoryId);
  const columns = useMemo(() => (category ? importColumnsFor(category.propertyDefs) : []), [category]);
  const errorByRow = new Map(preview?.errors.map((e) => [e.row, e.messages]) ?? []);

  const reset = () => {
    setRows([]);
    setPreview(null);
    setFileName("");
    setDone(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !category) return;
    reset();
    if (file.size > MAX_IMPORT_BYTES) return toast.error("ไฟล์ใหญ่เกิน 5 MB");
    if (!/\.(xlsx|csv)$/i.test(file.name)) return toast.error("รองรับเฉพาะไฟล์ .xlsx และ .csv");
    try {
      const parsed = await parseFile(file);
      if (!parsed.length) return toast.error("ไม่พบข้อมูลในไฟล์");
      if (parsed.length > MAX_IMPORT_ROWS) return toast.error(`นำเข้าได้ไม่เกิน ${MAX_IMPORT_ROWS} แถวต่อครั้ง (ไฟล์มี ${parsed.length} แถว)`);
      setFileName(file.name);
      setRows(parsed);
      startTransition(async () => setPreview(await previewImport({ categoryId: category.id, rows: parsed })));
    } catch {
      toast.error("อ่านไฟล์ไม่ได้ กรุณาใช้แม่แบบจากระบบ");
    }
  };

  const onCommit = () => {
    if (!category) return;
    startTransition(async () => {
      const result = await commitImport({ categoryId: category.id, rows });
      if (result.ok) {
        setDone(result.message ?? "นำเข้าเรียบร้อย");
        toast.success(result.message ?? "นำเข้าเรียบร้อย");
      } else {
        setPreview(result);
        toast.error(result.message ?? "นำเข้าไม่สำเร็จ");
      }
    });
  };

  const previewColumns = columns.filter((c) => rows.some((r) => r[c.key]));

  return (
    <div className="space-y-6">
      <Step n={1} title="เลือกประเภทและดาวน์โหลดแม่แบบ" active={!category} done={!!category}>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <SelectField
            label="ประเภทครุภัณฑ์"
            name="categoryId"
            options={categories.map((c) => ({ value: c.id, label: `${c.name} (${c.codePrefix})` }))}
            onValueChange={(v) => {
              setCategoryId(v);
              reset();
            }}
            hint="นำเข้าได้ครั้งละหนึ่งประเภท เพราะแต่ละประเภทมีคอลัมน์ข้อมูลเฉพาะต่างกัน"
          />
          <Button
            variant="outline"
            className="h-12 rounded-xl"
            disabled={!category}
            onClick={() => category && downloadTemplate(columns, category.name, category.codePrefix)}
          >
            <Download /> ดาวน์โหลดแม่แบบ (.xlsx)
          </Button>
        </div>
      </Step>

      <Step n={2} title="อัปโหลดไฟล์" active={!!category && !rows.length} done={rows.length > 0}>
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-8 text-center transition hover:border-primary hover:bg-accent/40 ${
            category ? "" : "pointer-events-none"
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files[0]);
          }}
        >
          {fileName ? <FileSpreadsheet className="size-10 text-primary" /> : <Upload className="size-10 text-muted-foreground" />}
          <span className="font-semibold">{fileName || "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก"}</span>
          <span className="text-sm text-muted-foreground">
            .xlsx หรือ .csv · ไม่เกิน 5 MB · ไม่เกิน {MAX_IMPORT_ROWS.toLocaleString()} แถว
          </span>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="sr-only" disabled={!category} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </Step>

      <Step n={3} title="ตรวจสอบและยืนยัน" active={rows.length > 0 && !done} done={!!done}>
        {pending && !preview && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> กำลังตรวจสอบข้อมูล...
          </p>
        )}
        {done ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="size-14 animate-pop text-emerald-500" />
            <p className="text-lg font-semibold">{done}</p>
            <div className="flex gap-2">
              <Button asChild variant="gradient" className="h-11 rounded-xl px-5">
                <Link href="/assets">ไปที่ทะเบียนครุภัณฑ์</Link>
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={reset}>
                นำเข้าไฟล์อื่น
              </Button>
            </div>
          </div>
        ) : (
          preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  ผ่าน {preview.validCount} แถว
                </span>
                {preview.errors.length > 0 && (
                  <span className="rounded-full bg-red-50 px-3 py-1.5 font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-300">
                    ไม่ผ่าน {preview.errors.length} แถว
                  </span>
                )}
                {preview.message && <span className="py-1.5 text-destructive">{preview.message}</span>}
              </div>

              <div className="max-h-[480px] overflow-auto rounded-2xl border border-border">
                <Table className="min-w-max text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-12">แถว</TableHead>
                      <TableHead>ผลตรวจ</TableHead>
                      {previewColumns.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => {
                      const errs = errorByRow.get(i + 1);
                      return (
                        <TableRow key={i} className={errs ? "bg-red-50/60 dark:bg-red-500/5" : ""}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="max-w-80 whitespace-normal">
                            {errs ? (
                              <ul className="space-y-0.5 text-destructive">
                                {errs.map((m) => (
                                  <li key={m} className="flex gap-1">
                                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">✓ ผ่าน</span>
                            )}
                          </TableCell>
                          {previewColumns.map((c) => (
                            <TableCell key={c.key}>{r[c.key] || ""}</TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {preview.ok ? "ข้อมูลถูกต้องทั้งหมด พร้อมนำเข้า" : "แก้ไขแถวที่ไม่ผ่านในไฟล์แล้วอัปโหลดใหม่ (ระบบนำเข้าเมื่อผ่านทุกแถวเท่านั้น)"}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-11 rounded-xl" onClick={() => fileRef.current?.click()}>
                    <Upload /> เลือกไฟล์ใหม่
                  </Button>
                  <Button variant="gradient" className="h-11 rounded-xl px-5" disabled={!preview.ok || pending} onClick={onCommit}>
                    {pending && <Loader2 className="animate-spin" />}
                    นำเข้า {preview.validCount} รายการ
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
      </Step>
    </div>
  );
}
