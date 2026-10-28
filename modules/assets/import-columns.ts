import type { PropertyDefLike } from "./properties";

/** Client-safe description of import template columns. Header text is "Label (key)" so files stay readable and parseable. */
export type ImportColumn = { key: string; label: string; required?: boolean; hint?: string };

export const baseImportColumns: ImportColumn[] = [
  { key: "name", label: "ชื่อครุภัณฑ์", required: true },
  { key: "brand", label: "ยี่ห้อ" },
  { key: "model", label: "รุ่น" },
  { key: "serialNumber", label: "Serial Number" },
  { key: "barcode", label: "บาร์โค้ดผู้ผลิต" },
  { key: "purchaseDate", label: "วันที่ซื้อ", hint: "YYYY-MM-DD (ค.ศ.)" },
  { key: "warrantyExpiry", label: "ประกันหมดอายุ", hint: "YYYY-MM-DD (ค.ศ.)" },
  { key: "cost", label: "ราคา" },
  { key: "status", label: "สถานะ", hint: "สำรอง/ในคลัง, พร้อมใช้งาน, ใช้งานอยู่" },
  { key: "condition", label: "สภาพ", hint: "ดี, พอใช้, ชำรุด" },
  { key: "owner", label: "ผู้ถือครอง", hint: "username" },
  { key: "department", label: "แผนก", hint: "ชื่อแผนก" },
  { key: "location", label: "สถานที่", hint: "path เต็ม เช่น อาคาร A / ชั้น 1 / ห้อง 101" },
  { key: "note", label: "หมายเหตุ" },
];

export const PROP_COLUMN_PREFIX = "prop:";

export function importColumnsFor(defs: PropertyDefLike[]): ImportColumn[] {
  return [
    ...baseImportColumns,
    ...defs.map((d) => ({
      key: `${PROP_COLUMN_PREFIX}${d.key}`,
      label: d.label,
      required: d.required,
      hint: d.type === "SELECT" ? d.options.join(", ") : d.type === "BOOLEAN" ? "ใช่/ไม่ใช่" : d.type === "DATE" ? "YYYY-MM-DD" : undefined,
    })),
  ];
}

export function headerText(c: ImportColumn) {
  return `${c.label}${c.required ? "*" : ""} (${c.key})`;
}

/** Extract the key from a header like "ชื่อครุภัณฑ์* (name)"; falls back to the raw header. */
export function keyFromHeader(header: string) {
  const m = header.match(/\(([^()]+)\)\s*$/);
  return (m ? m[1] : header).trim();
}

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
