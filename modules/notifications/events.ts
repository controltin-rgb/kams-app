import { z } from "zod";

// Client-safe: shared by the settings form, the settings schema and the notification service.

export const channels = ["inApp", "email", "line"] as const;
export type Channel = (typeof channels)[number];
export const channelLabels: Record<Channel, string> = { inApp: "ในระบบ", email: "อีเมล", line: "LINE" };

export const recipientGroups = ["reporter", "assignee", "managers", "admins", "techs"] as const;
export type RecipientGroup = (typeof recipientGroups)[number];
export const recipientLabels: Record<RecipientGroup, string> = {
  reporter: "ผู้แจ้ง",
  assignee: "ผู้รับผิดชอบ",
  managers: "ผู้จัดการ",
  admins: "ผู้ดูแลระบบ",
  techs: "ช่างทุกคน",
};

const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof priorities)[number];

type EventDef = {
  label: string;
  description: string;
  /** Recipient groups that make sense for this event */
  recipients: readonly RecipientGroup[];
  /** Extra condition shown in the settings form */
  condition?: "minPriority" | "daysBefore";
  /** Sent by the scheduled check (/api/cron/notify) rather than by a user action */
  scheduled?: boolean;
  defaults: { enabled: boolean; channels: Channel[]; recipients: RecipientGroup[]; minPriority?: Priority; daysBefore?: number };
};

export const notifyEvents = {
  TICKET_CREATED: {
    label: "มีงานแจ้งซ่อมใหม่",
    description: "เมื่อมีการแจ้งซ่อม (เว็บ/QR)",
    recipients: ["managers", "admins", "techs"],
    condition: "minPriority",
    defaults: { enabled: true, channels: ["inApp"], recipients: ["managers"], minPriority: "LOW" },
  },
  TICKET_ASSIGNED: {
    label: "ได้รับมอบหมายงานซ่อม",
    description: "เมื่อมอบหมายงานให้ช่าง",
    recipients: ["assignee"],
    defaults: { enabled: true, channels: ["inApp"], recipients: ["assignee"] },
  },
  TICKET_STATUS: {
    label: "สถานะงานแจ้งซ่อมเปลี่ยน",
    description: "เช่น เริ่มดำเนินการ ซ่อมเสร็จ ปิดงาน",
    recipients: ["reporter", "assignee"],
    defaults: { enabled: true, channels: ["inApp"], recipients: ["reporter"] },
  },
  TICKET_SLA_OVERDUE: {
    label: "งานซ่อมเกิน SLA",
    description: "ตรวจตามรอบเวลา แจ้งครั้งเดียวต่อกำหนดเวลา",
    recipients: ["assignee", "managers", "admins"],
    condition: "minPriority",
    scheduled: true,
    defaults: { enabled: true, channels: ["inApp"], recipients: ["assignee", "managers"], minPriority: "LOW" },
  },
  PM_DUE: {
    label: "งาน PM ใกล้ถึงกำหนด",
    description: "แจ้งล่วงหน้าตามจำนวนวันที่กำหนด",
    recipients: ["assignee", "managers"],
    condition: "daysBefore",
    scheduled: true,
    defaults: { enabled: true, channels: ["inApp"], recipients: ["assignee"], daysBefore: 1 },
  },
  PM_OVERDUE: {
    label: "งาน PM เลยกำหนด",
    description: "เมื่อ PM เปลี่ยนเป็นเลยกำหนด",
    recipients: ["assignee", "managers"],
    scheduled: true,
    defaults: { enabled: true, channels: ["inApp"], recipients: ["assignee", "managers"] },
  },
  CLAIM_OVERDUE: {
    label: "เคลมเกินกำหนดรับคืน",
    description: "เลยวันที่คาดว่าจะได้รับคืน",
    recipients: ["managers", "admins"],
    scheduled: true,
    defaults: { enabled: true, channels: ["inApp"], recipients: ["managers"] },
  },
  WARRANTY_EXPIRING: {
    label: "ประกันใกล้หมด",
    description: "แจ้งล่วงหน้าตามจำนวนวันที่กำหนด",
    recipients: ["managers", "admins"],
    condition: "daysBefore",
    scheduled: true,
    defaults: { enabled: false, channels: ["inApp"], recipients: ["managers"], daysBefore: 30 },
  },
  BACKUP_FAILED: {
    label: "สำรองข้อมูลล้มเหลว",
    description: "เมื่อการสำรองข้อมูล (สร้างเองหรืออัตโนมัติ) ไม่สำเร็จ",
    recipients: ["admins"],
    defaults: { enabled: true, channels: ["inApp"], recipients: ["admins"] },
  },
} as const satisfies Record<string, EventDef>;

export type NotifyEvent = keyof typeof notifyEvents;
export const notifyEventKeys = Object.keys(notifyEvents) as NotifyEvent[];

export const eventConfigSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.enum(channels)),
  recipients: z.array(z.enum(recipientGroups)),
  minPriority: z.enum(priorities).optional(),
  daysBefore: z.coerce.number().int().min(0).max(365).optional(),
});
export type EventConfig = z.infer<typeof eventConfigSchema>;

/** Defaults for every event; stored settings are merged on top key by key. */
export function defaultEventConfigs(): Record<NotifyEvent, EventConfig> {
  return Object.fromEntries(notifyEventKeys.map((k) => [k, { ...notifyEvents[k].defaults, channels: [...notifyEvents[k].defaults.channels], recipients: [...notifyEvents[k].defaults.recipients] }])) as Record<
    NotifyEvent,
    EventConfig
  >;
}

const rank: Record<Priority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
export function meetsPriority(priority: Priority | undefined, min: Priority | undefined) {
  return !min || !priority || rank[priority] >= rank[min];
}
