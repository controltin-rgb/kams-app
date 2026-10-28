import { paperPresets, type LabelElement } from "./design";

// Starter templates (seeded). Plain module without "@/..." imports so prisma/seed.ts can use it.

const a4 = paperPresets.A4_4x10;
const W = a4.labelWidthMm;
const H = a4.labelHeightMm;

export const defaultAssetDesign: LabelElement[] = [
  { id: "qr", type: "qr", x: 1.5, y: 2.7, w: 20, h: 20, rotation: 0 },
  { id: "org", type: "field", field: "orgName", prefix: "", x: 23, y: 1.6, w: 24, h: 3.2, rotation: 0, fontSize: 5.5, bold: true, align: "left", color: "#000000" },
  { id: "code", type: "field", field: "assetCode", prefix: "", x: 23, y: 5.2, w: 24, h: 4.4, rotation: 0, fontSize: 8, bold: true, align: "left", color: "#000000" },
  { id: "name", type: "field", field: "name", prefix: "", x: 23, y: 10, w: 24, h: 3.4, rotation: 0, fontSize: 5.5, bold: false, align: "left", color: "#000000" },
  { id: "bar", type: "barcode", x: 23, y: 14, w: 24, h: 9.5, rotation: 0, showText: false },
];

function statusDesign(text: string, color: string): LabelElement[] {
  return [
    { id: "bg", type: "rect", x: 1, y: 1, w: W - 2, h: H - 2, rotation: 0, fill: color, stroke: "transparent", strokeWidth: 0, radius: 2 },
    { id: "title", type: "text", text, x: 2, y: 5, w: W - 4, h: 9, rotation: 0, fontSize: 13, bold: true, align: "center", color: "#ffffff" },
    { id: "org", type: "text", text: "{orgName}", x: 2, y: 16.5, w: W - 4, h: 4, rotation: 0, fontSize: 5.5, bold: false, align: "center", color: "#ffffff" },
  ];
}

/** The five status stickers agreed with the organisation */
export const defaultStatusTemplates = [
  { name: "ฉลากสถานะ: ใช้งานได้", design: statusDesign("ใช้งานได้", "#16a34a") },
  { name: "ฉลากสถานะ: ระหว่างซ่อม", design: statusDesign("ระหว่างซ่อม", "#ea580c") },
  { name: "ฉลากสถานะ: ชำรุด / ห้ามใช้", design: statusDesign("ชำรุด / ห้ามใช้", "#dc2626") },
  { name: "ฉลากสถานะ: รอจำหน่าย", design: statusDesign("รอจำหน่าย", "#6b7280") },
  { name: "ฉลากสถานะ: ตรวจนับแล้ว", design: statusDesign("ตรวจนับแล้ว ปี {yearBE}", "#2563eb") },
];

const { label: _presetLabel, ...a4Layout } = a4;
void _presetLabel;
export const defaultLayout = a4Layout;
