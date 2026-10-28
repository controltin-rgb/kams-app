import type { LocationType, PropertyType } from "../generated/prisma/client";

type PropDef = { key: string; label: string; type: PropertyType; required?: boolean; options?: string[] };
type CategorySeed = { name: string; codePrefix: string; description?: string; props: PropDef[] };

const OS = ["Windows 11", "Windows 10", "Ubuntu", "macOS", "อื่นๆ"];
const computer: PropDef[] = [
  { key: "cpu", label: "CPU", type: "TEXT", required: true },
  { key: "ram_gb", label: "RAM (GB)", type: "NUMBER", required: true },
  { key: "storage", label: "Storage", type: "TEXT" },
  { key: "os", label: "ระบบปฏิบัติการ", type: "SELECT", options: OS },
  { key: "ip", label: "IP Address", type: "TEXT" },
  { key: "mac", label: "MAC Address", type: "TEXT" },
];

export const categories: CategorySeed[] = [
  { name: "คอมพิวเตอร์ตั้งโต๊ะ", codePrefix: "PC", props: computer },
  { name: "โน้ตบุ๊ก", codePrefix: "NB", props: [...computer, { key: "screen_inch", label: "ขนาดจอ (นิ้ว)", type: "NUMBER" }] },
  { name: "All-in-One PC", codePrefix: "AIO", props: computer },
  {
    name: "จอภาพ",
    codePrefix: "MON",
    props: [
      { key: "size_inch", label: "ขนาด (นิ้ว)", type: "NUMBER", required: true },
      { key: "resolution", label: "ความละเอียด", type: "SELECT", options: ["1920x1080", "2560x1440", "3840x2160"] },
      { key: "ports", label: "พอร์ต", type: "TEXT" },
    ],
  },
  {
    name: "เครื่องพิมพ์",
    codePrefix: "PRT",
    props: [
      { key: "printer_type", label: "ชนิด", type: "SELECT", required: true, options: ["Laser", "Inkjet", "Dot Matrix", "Thermal"] },
      { key: "color", label: "พิมพ์สี", type: "BOOLEAN" },
      { key: "network", label: "เชื่อมต่อเครือข่าย", type: "BOOLEAN" },
      { key: "ip", label: "IP Address", type: "TEXT" },
    ],
  },
  {
    name: "อุปกรณ์เครือข่าย",
    codePrefix: "NET",
    props: [
      { key: "device_type", label: "ชนิดอุปกรณ์", type: "SELECT", required: true, options: ["Switch", "Router", "Access Point", "Firewall"] },
      { key: "ports", label: "จำนวนพอร์ต", type: "NUMBER" },
      { key: "ip", label: "IP Address", type: "TEXT" },
      { key: "mac", label: "MAC Address", type: "TEXT" },
    ],
  },
  {
    name: "เครื่องสำรองไฟ (UPS)",
    codePrefix: "UPS",
    props: [
      { key: "capacity_va", label: "ขนาด (VA)", type: "NUMBER", required: true },
      { key: "battery_replaced", label: "วันที่เปลี่ยนแบตเตอรี่", type: "DATE" },
    ],
  },
  {
    name: "เครื่องปรับอากาศ",
    codePrefix: "AC",
    props: [
      { key: "btu", label: "BTU", type: "NUMBER", required: true },
      { key: "ac_type", label: "ชนิด", type: "SELECT", options: ["ติดผนัง", "แขวนใต้ฝ้า", "ตั้งพื้น", "ฝังฝ้า", "ตู้ตั้ง"] },
      { key: "inverter", label: "Inverter", type: "BOOLEAN" },
      { key: "refrigerant", label: "น้ำยา", type: "TEXT" },
    ],
  },
];

export const departments = ["ฝ่ายบริหาร", "ฝ่ายบุคคล", "ฝ่ายบัญชีและการเงิน", "ฝ่ายเทคโนโลยีสารสนเทศ", "ฝ่ายอาคารสถานที่"];

type LocationSeed = { name: string; type: LocationType; children?: LocationSeed[] };
export const locations: LocationSeed[] = [
  {
    name: "อาคาร A (สำนักงานใหญ่)",
    type: "BUILDING",
    children: [
      { name: "ชั้น 1", type: "FLOOR", children: [{ name: "ห้อง 101 ฝ่ายบุคคล", type: "ROOM" }, { name: "ห้อง Server", type: "ROOM" }] },
      { name: "ชั้น 2", type: "FLOOR", children: [{ name: "ห้อง 201 ฝ่ายไอที", type: "ROOM" }, { name: "ห้องประชุม 1", type: "ROOM" }] },
    ],
  },
  { name: "อาคาร B", type: "BUILDING", children: [{ name: "ชั้น 1", type: "FLOOR", children: [{ name: "คลังพัสดุ", type: "ROOM" }] }] },
];

export const vendors = [
  { name: "บริษัท ตัวอย่าง ไอที ซัพพลาย จำกัด", contact: "ฝ่ายขาย", phone: "02-000-0001", email: "sales@example.com" },
  { name: "บริษัท ตัวอย่าง เซอร์วิส จำกัด", contact: "ฝ่ายบริการลูกค้า", phone: "02-000-0002", email: "service@example.com" },
];
