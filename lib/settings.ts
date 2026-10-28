import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultEventConfigs, eventConfigSchema, notifyEventKeys, type NotifyEvent } from "@/modules/notifications/events";

const hours = z.coerce.number().int().min(1).max(24 * 90);

/** All system settings with defaults. Stored one row per key in SystemSetting. */
export const settingsSchema = z.object({
  // Organisation name shown on labels and printed documents
  "org.name": z.string().min(1).max(200).default("หน่วยงานของคุณ"),
  // SLA: hours from creation until the ticket should be resolved (calendar hours)
  "ticket.slaHours": z
    .object({ LOW: hours, MEDIUM: hours, HIGH: hours, CRITICAL: hours })
    .default({ LOW: 72, MEDIUM: 24, HIGH: 8, CRITICAL: 4 }),
  // Allow reporting a repair from the public QR page without signing in
  "ticket.allowAnonymousQr": z.boolean().default(false),
  // PM: how many days ahead runs are generated
  "pm.leadDays": z.coerce.number().int().min(0).max(90).default(14),
  // Backup: scheduled daily backup via /api/cron/backup, and how many backup files to keep
  "backup.autoEnabled": z.boolean().default(true),
  "backup.keep": z.coerce.number().int().min(1).max(365).default(14),
  // Shown on the System Info page; edited by system:editInfo
  "system.releaseNotes": z.string().max(20000).default(""),
  "system.roadmap": z.string().max(20000).default(""),
  // Notifications: global channel switches and per-event rules (unknown/missing events fall back to defaults)
  "notify.channels": z.object({ inApp: z.boolean(), email: z.boolean(), line: z.boolean() }).default({ inApp: true, email: false, line: false }),
  "notify.events": z
    .record(z.string(), eventConfigSchema.partial())
    .default({})
    .transform((stored) => {
      const out = defaultEventConfigs();
      for (const key of notifyEventKeys) if (stored[key]) out[key] = { ...out[key], ...stored[key] };
      return out as Record<NotifyEvent, (typeof out)[NotifyEvent]>;
    }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: Object.keys(settingsSchema.shape) } } });
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const parsed = settingsSchema.safeParse(raw);
  // Invalid stored values fall back to defaults key by key
  if (parsed.success) return parsed.data;
  const out = settingsSchema.parse({});
  for (const key of Object.keys(settingsSchema.shape) as SettingKey[]) {
    const one = settingsSchema.shape[key].safeParse(raw[key]);
    if (one.success) (out as Record<SettingKey, unknown>)[key] = one.data;
  }
  return out;
}

export async function setSetting<K extends SettingKey>(tx: Prisma.TransactionClient, key: K, value: Settings[K]) {
  const json = value as Prisma.InputJsonValue;
  await tx.systemSetting.upsert({ where: { key }, update: { value: json }, create: { key, value: json } });
}
