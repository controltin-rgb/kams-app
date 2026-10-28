import { z } from "zod";

// All positions and sizes are in millimetres, relative to the top-left of one label.

export const labelFields = {
  assetCode: "รหัสครุภัณฑ์",
  name: "ชื่อครุภัณฑ์",
  category: "ประเภท",
  brandModel: "ยี่ห้อ / รุ่น",
  serialNumber: "Serial Number",
  location: "สถานที่",
  owner: "ผู้ถือครอง",
  department: "แผนก",
  purchaseDate: "วันที่ซื้อ",
  orgName: "ชื่อหน่วยงาน",
} as const;
export type LabelField = keyof typeof labelFields;

const base = {
  id: z.string().min(1).max(40),
  x: z.number().min(-50).max(500),
  y: z.number().min(-50).max(500),
  w: z.number().min(1).max(500),
  h: z.number().min(1).max(500),
  rotation: z.number().min(-360).max(360).default(0),
};

const textStyle = {
  fontSize: z.number().min(3).max(72).default(8), // pt
  bold: z.boolean().default(false),
  align: z.enum(["left", "center", "right"]).default("left"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000"),
};

export const labelElementSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("text"), text: z.string().max(200), ...textStyle }),
  z.object({ ...base, type: z.literal("field"), field: z.enum(Object.keys(labelFields) as [LabelField, ...LabelField[]]), prefix: z.string().max(40).default(""), ...textStyle }),
  z.object({ ...base, type: z.literal("barcode"), showText: z.boolean().default(true) }),
  z.object({ ...base, type: z.literal("qr") }),
  z.object({ ...base, type: z.literal("image"), attachmentId: z.string().max(40) }),
  z.object({
    ...base,
    type: z.literal("rect"),
    fill: z.string().regex(/^(#[0-9a-fA-F]{6}|transparent)$/).default("transparent"),
    stroke: z.string().regex(/^(#[0-9a-fA-F]{6}|transparent)$/).default("#000000"),
    strokeWidth: z.number().min(0).max(5).default(0.3),
    radius: z.number().min(0).max(20).default(0),
  }),
]);
export type LabelElement = z.infer<typeof labelElementSchema>;
export type LabelElementType = LabelElement["type"];

export const labelDesignSchema = z.object({ elements: z.array(labelElementSchema).max(50) });
export type LabelDesign = z.infer<typeof labelDesignSchema>;

export const layoutSchema = z.object({
  pageWidthMm: z.coerce.number().min(10).max(500),
  pageHeightMm: z.coerce.number().min(10).max(1000),
  labelWidthMm: z.coerce.number().min(5).max(500),
  labelHeightMm: z.coerce.number().min(5).max(500),
  columns: z.coerce.number().int().min(1).max(20),
  rows: z.coerce.number().int().min(1).max(50),
  marginTopMm: z.coerce.number().min(0).max(100),
  marginLeftMm: z.coerce.number().min(0).max(100),
  gapXMm: z.coerce.number().min(0).max(50),
  gapYMm: z.coerce.number().min(0).max(50),
});
export type LabelLayout = z.infer<typeof layoutSchema>;

/** Paper presets. Default for this organisation: A4 sticker 4×10 (48.5×25.4 mm). */
export const paperPresets: Record<string, { label: string } & LabelLayout> = {
  A4_4x10: {
    label: "A4 สติกเกอร์ 4×10 ดวง (48.5×25.4 มม.)",
    pageWidthMm: 210, pageHeightMm: 297, labelWidthMm: 48.5, labelHeightMm: 25.4,
    columns: 4, rows: 10, marginTopMm: 21.5, marginLeftMm: 8, gapXMm: 0, gapYMm: 0,
  },
  A4_3x8: {
    label: "A4 สติกเกอร์ 3×8 ดวง (70×37 มม.)",
    pageWidthMm: 210, pageHeightMm: 297, labelWidthMm: 70, labelHeightMm: 37,
    columns: 3, rows: 8, marginTopMm: 0.5, marginLeftMm: 0, gapXMm: 0, gapYMm: 0,
  },
  THERMAL_50x30: {
    label: "Thermal ม้วน 50×30 มม.",
    pageWidthMm: 50, pageHeightMm: 30, labelWidthMm: 50, labelHeightMm: 30,
    columns: 1, rows: 1, marginTopMm: 0, marginLeftMm: 0, gapXMm: 0, gapYMm: 0,
  },
  THERMAL_40x25: {
    label: "Thermal ม้วน 40×25 มม.",
    pageWidthMm: 40, pageHeightMm: 25, labelWidthMm: 40, labelHeightMm: 25,
    columns: 1, rows: 1, marginTopMm: 0, marginLeftMm: 0, gapXMm: 0, gapYMm: 0,
  },
  CUSTOM: {
    label: "กำหนดเอง",
    pageWidthMm: 210, pageHeightMm: 297, labelWidthMm: 50, labelHeightMm: 30,
    columns: 4, rows: 9, marginTopMm: 10, marginLeftMm: 5, gapXMm: 2, gapYMm: 2,
  },
};

/** Data for one asset label (strings already formatted for display). */
export type LabelData = Partial<Record<LabelField, string>> & { assetCode?: string };

export const sampleLabelData: LabelData = {
  assetCode: "PC-2026-0001",
  name: "คอมพิวเตอร์ตั้งโต๊ะ",
  category: "คอมพิวเตอร์ตั้งโต๊ะ",
  brandModel: "Dell OptiPlex 7010",
  serialNumber: "SN12345678",
  location: "อาคาร A / ชั้น 2 / ห้อง 201",
  owner: "สมชาย ใจดี",
  department: "ฝ่ายไอที",
  purchaseDate: "1 ม.ค. 2569",
  orgName: "หน่วยงานของคุณ",
};

/** Replace {orgName} {yearBE} {year} {date} in free text. */
export function fillPlaceholders(text: string, ctx: { orgName: string; now: Date }) {
  const yearCE = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(ctx.now));
  const date = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }).format(ctx.now);
  return text
    .replaceAll("{orgName}", ctx.orgName)
    .replaceAll("{yearBE}", String(yearCE + 543))
    .replaceAll("{year}", String(yearCE))
    .replaceAll("{date}", date);
}

/** Label slots per sheet (top-left first, row by row). */
export function slotPositions(l: LabelLayout) {
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < l.rows; r++) {
    for (let c = 0; c < l.columns; c++) {
      out.push({ x: l.marginLeftMm + c * (l.labelWidthMm + l.gapXMm), y: l.marginTopMm + r * (l.labelHeightMm + l.gapYMm) });
    }
  }
  return out;
}

/** Split labels into sheets, leaving the first `offset` slots empty (CLAUDE.md §8: start at label n). */
export function paginate<T>(items: T[], perSheet: number, startAt = 1): (T | null)[][] {
  const skip = Math.max(0, Math.min(startAt - 1, perSheet - 1));
  const cells: (T | null)[] = [...Array<null>(skip).fill(null), ...items];
  const sheets: (T | null)[][] = [];
  for (let i = 0; i < cells.length; i += perSheet) sheets.push(cells.slice(i, i + perSheet));
  return sheets;
}

export function newElementId() {
  return Math.random().toString(36).slice(2, 10);
}
