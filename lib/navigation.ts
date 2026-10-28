import {
  ArrowLeftRight,
  CalendarCheck,
  ClipboardCheck,
  Cloud,
  Database,
  Headset,
  Home,
  Info,
  MonitorSmartphone,
  ScanBarcode,
  ScrollText,
  Settings,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/gradient-icon";
import { can, type Action, type Resource } from "@/lib/permissions";

type Permission = { [R in Resource]: { resource: R; action: Action<R> } }[Resource];

export type NavLink = {
  label: string;
  href: string;
  permission?: Permission;
  /** Not built yet — shown disabled with a "soon" badge */
  soon?: boolean;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
  permission?: Permission;
  soon?: boolean;
  children?: NavLink[];
};

export const navigation: NavGroup[] = [
  { label: "Dashboard", icon: Home, tone: "violet", href: "/dashboard" },
  {
    label: "ครุภัณฑ์",
    icon: MonitorSmartphone,
    tone: "orange",
    permission: { resource: "asset", action: "view" },
    children: [
      { label: "ทะเบียนครุภัณฑ์", href: "/assets" },
      { label: "เพิ่มหลายรายการ", href: "/assets/bulk", permission: { resource: "asset", action: "create" } },
      { label: "นำเข้าข้อมูล", href: "/assets/import", permission: { resource: "asset", action: "import" } },
    ],
  },
  {
    label: "ข้อมูลหลัก",
    icon: Database,
    tone: "blue",
    permission: { resource: "masterData", action: "view" },
    children: [
      { label: "ประเภทครุภัณฑ์", href: "/master/categories" },
      { label: "สถานที่", href: "/master/locations" },
      { label: "แผนก", href: "/master/departments" },
      { label: "ผู้ขาย/ผู้ให้บริการ", href: "/master/vendors" },
    ],
  },
  {
    label: "การถือครอง & Swap",
    icon: ArrowLeftRight,
    tone: "green",
    permission: { resource: "deployment", action: "view" },
    children: [
      { label: "เอกสารทั้งหมด", href: "/deployments" },
      { label: "ส่งมอบ / คืน / ย้าย", href: "/deployments/new", permission: { resource: "deployment", action: "create" } },
      { label: "เปลี่ยนเครื่อง (Swap)", href: "/deployments/swap", permission: { resource: "deployment", action: "swap" } },
    ],
  },
  {
    label: "แจ้งซ่อม",
    icon: Headset,
    tone: "pink",
    permission: { resource: "ticket", action: "view" },
    children: [
      { label: "รายการแจ้งซ่อม", href: "/tickets" },
      { label: "แจ้งซ่อมใหม่", href: "/tickets/new", permission: { resource: "ticket", action: "create" } },
    ],
  },
  {
    label: "บำรุงรักษา (PM)",
    icon: CalendarCheck,
    tone: "teal",
    permission: { resource: "pm", action: "view" },
    children: [
      { label: "ปฏิทิน & งานค้าง", href: "/pm" },
      { label: "แผน PM", href: "/pm/schedules" },
    ],
  },
  { label: "ส่งเคลม", icon: Wrench, tone: "blue", href: "/claims", permission: { resource: "claim", action: "view" } },
  { label: "ตรวจนับครุภัณฑ์", icon: ClipboardCheck, tone: "violet", href: "/audits", permission: { resource: "audit", action: "view" } },
  {
    label: "จัดการฉลาก",
    icon: ScanBarcode,
    tone: "orange",
    permission: { resource: "label", action: "view" },
    children: [
      { label: "แม่แบบฉลาก", href: "/labels" },
      { label: "พิมพ์ฉลาก", href: "/labels/print" },
    ],
  },
  {
    label: "ระบบความปลอดภัย",
    icon: ShieldCheck,
    tone: "red",
    children: [
      { label: "จัดการผู้ใช้งาน", href: "/admin/users", permission: { resource: "user", action: "list" } },
      { label: "จัดการสิทธิ์การใช้งาน", href: "/admin/roles", permission: { resource: "role", action: "view" } },
    ],
  },
  { label: "Audit Log", icon: ScrollText, tone: "violet", href: "/admin/audit-logs", permission: { resource: "log", action: "view" } },
  { label: "Backup / Restore", icon: Cloud, tone: "green", href: "/admin/backup", permission: { resource: "backup", action: "view" } },
  { label: "การตั้งค่า", icon: Settings, tone: "teal", href: "/admin/settings", permission: { resource: "system", action: "editInfo" } },
  {
    label: "ระบบ",
    icon: Info,
    tone: "orange",
    children: [
      { label: "ข้อมูลระบบ", href: "/admin/system-info", permission: { resource: "system", action: "view" } },
      // Everyone signed in can read the user guide
      { label: "การใช้งานระบบ", href: "/manual" },
    ],
  },
];

/** Extra titles for routes not listed in the sidebar */
const extraTitles: Record<string, string> = { "/profile": "Profile", "/notifications": "การแจ้งเตือน", "/office-3d": "3D Office" };

function allowed(role: string, permission?: Permission) {
  if (!permission) return true;
  return (can as (role: string, resource: Resource, action: string) => boolean)(role, permission.resource, permission.action);
}

/** Navigation filtered by role. UX only — pages re-check permissions on the server. */
export function navigationFor(role: string): NavGroup[] {
  return navigation
    .filter((g) => allowed(role, g.permission))
    .map((g) => ({ ...g, children: g.children?.filter((c) => allowed(role, c.permission)) }))
    .filter((g) => g.href || (g.children && g.children.length > 0));
}

/** The most specific nav href matching the path (e.g. /assets/bulk wins over /assets). */
export function activeHref(pathname: string): string | undefined {
  const hrefs = navigation.flatMap((g) => [g.href, ...(g.children ?? []).map((c) => c.href)]).filter((h): h is string => !!h);
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function pageTitle(pathname: string): string {
  if (extraTitles[pathname]) return extraTitles[pathname];
  const href = activeHref(pathname);
  if (!href) return ""; // otherwise matches the first group that has no href of its own
  for (const g of navigation) {
    if (g.href === href) return g.label;
    const child = g.children?.find((c) => c.href === href);
    if (child) return child.label;
  }
  return "";
}

