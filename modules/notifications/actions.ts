"use server";

import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/audit";
import type { FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { channels, notifyEventKeys, notifyEvents, recipientGroups, type Channel, type EventConfig, type NotifyEvent } from "./events";
import { channelReady, sendTest } from "./service";

// ---------- Header bell (own notifications only) ----------

export async function myNotifications() {
  const session = await requireSession();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, event: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);
  return { unread, items: items.map((n) => ({ ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })) };
}
export type MyNotifications = Awaited<ReturnType<typeof myNotifications>>;

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({ where: { id, userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(): Promise<FormState> {
  const session = await requireSession();
  const { count } = await prisma.notification.updateMany({ where: { userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  return { ok: true, message: count ? `อ่านแล้ว ${count} รายการ` : "ไม่มีรายการที่ยังไม่อ่าน" };
}

// ---------- Settings ----------

/**
 * Save channel switches and per-event rules. Field names: `channel.<c>`, `ev.<EVENT>.enabled`,
 * `ev.<EVENT>.ch.<c>`, `ev.<EVENT>.to.<group>`, `ev.<EVENT>.minPriority`, `ev.<EVENT>.daysBefore`.
 */
export async function saveNotificationSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requirePermission("system", "editInfo");
  const on = (name: string) => formData.get(name) === "true";

  const globalChannels = Object.fromEntries(channels.map((c) => [c, on(`channel.${c}`)])) as Record<Channel, boolean>;
  const events = {} as Record<NotifyEvent, EventConfig>;
  const errors: string[] = [];
  for (const key of notifyEventKeys) {
    const def = notifyEvents[key];
    const cfg: EventConfig = {
      enabled: on(`ev.${key}.enabled`),
      channels: channels.filter((c) => on(`ev.${key}.ch.${c}`)),
      // Only groups that apply to this event are accepted
      recipients: recipientGroups.filter((g) => (def.recipients as readonly string[]).includes(g) && on(`ev.${key}.to.${g}`)),
    };
    if ("condition" in def && def.condition === "minPriority") {
      const v = String(formData.get(`ev.${key}.minPriority`) ?? "LOW");
      cfg.minPriority = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).find((p) => p === v) ?? "LOW";
    }
    if ("condition" in def && def.condition === "daysBefore") {
      const n = Number(formData.get(`ev.${key}.daysBefore`));
      if (!Number.isInteger(n) || n < 0 || n > 365) errors.push(`${def.label}: จำนวนวันต้องเป็น 0–365`);
      else cfg.daysBefore = n;
    }
    if (cfg.enabled && (!cfg.channels.length || !cfg.recipients.length)) errors.push(`${def.label}: เลือกช่องทางและผู้รับอย่างน้อยอย่างละ 1`);
    events[key] = cfg;
  }
  if (errors.length) return { message: errors.join(" · ") };

  await prisma.$transaction(async (tx) => {
    await setSetting(tx, "notify.channels", globalChannels);
    await setSetting(tx, "notify.events", events);
    await logAction({ userId: session.user.id, impersonatedBy: session.session.impersonatedBy, action: "UPDATE_SETTINGS", module: "notification", details: { channels: globalChannels } }, tx);
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "บันทึกการตั้งค่าการแจ้งเตือนแล้ว" };
}

export async function sendTestNotification(channel: Channel): Promise<FormState> {
  const session = await requirePermission("system", "editInfo");
  if (!channels.includes(channel)) return { message: "ช่องทางไม่ถูกต้อง" };
  if (!channelReady()[channel]) return { message: "ยังไม่ได้ตั้งค่าช่องทางนี้ใน .env" };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, email: true, lineUserId: true } });
  try {
    await sendTest(channel, user);
  } catch (e) {
    return { message: `ส่งไม่สำเร็จ: ${(e as Error).message}` };
  }
  await logAction({ userId: user.id, impersonatedBy: session.session.impersonatedBy, action: "NOTIFY_TEST", module: "notification", details: { channel } });
  return { ok: true, message: channel === "inApp" ? "ส่งแล้ว ดูที่กระดิ่งด้านบน" : `ส่งแล้ว ไปที่${channel === "email" ? ` ${user.email}` : " LINE ของคุณ"}` };
}
