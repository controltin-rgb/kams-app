import "server-only";
import { after } from "next/server";
import nodemailer from "nodemailer";
import { logAction } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { loadRoles } from "@/lib/roles";
import { getSettings } from "@/lib/settings";
import { meetsPriority, type Channel, type NotifyEvent, type Priority, type RecipientGroup } from "./events";

export type NotifyInput = {
  event: NotifyEvent;
  title: string;
  body?: string;
  /** In-app link, e.g. /tickets/<id> */
  href?: string;
  /** People tied to the record; used by the "reporter" / "assignee" recipient groups */
  related?: { reporter?: string | null; assignee?: string | null };
  priority?: Priority;
  /** The user who caused the event is never notified about their own action */
  actorId?: string | null;
  /** Reminders: notify only the first time this key is seen */
  dedupeKey?: string;
};

/** Which external channels have their credentials in .env (secrets never live in the database). */
export function channelReady(): Record<Channel, boolean> {
  return {
    inApp: true,
    email: !!(process.env.SMTP_HOST && process.env.SMTP_FROM),
    line: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
  };
}

async function resolveRecipients(groups: readonly RecipientGroup[], related: NotifyInput["related"] = {}) {
  const ids = new Set<string>();
  if (groups.includes("reporter") && related.reporter) ids.add(related.reporter);
  if (groups.includes("assignee") && related.assignee) ids.add(related.assignee);
  if (groups.some((g) => g === "managers" || g === "admins" || g === "techs")) {
    // May run outside a request (cron), so make sure edited role permissions are loaded
    const [users] = await Promise.all([prisma.user.findMany({ where: { banned: false, deletedAt: null }, select: { id: true, role: true } }), loadRoles()]);
    for (const u of users) {
      const roles = u.role.split(",").map((r) => r.trim());
      if (groups.includes("managers") && roles.includes("manager")) ids.add(u.id);
      if (groups.includes("admins") && roles.includes("admin")) ids.add(u.id);
      if (groups.includes("techs") && !roles.includes("admin") && can(u.role, "ticket", "update")) ids.add(u.id);
    }
  }
  return ids;
}

function absoluteUrl(href?: string) {
  const base = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  return href && base ? `${base}${href}` : undefined;
}

async function sendEmail(to: string[], subject: string, text: string) {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  // One message per recipient so addresses are not disclosed to each other
  await Promise.all(to.map((addr) => transport.sendMail({ from: process.env.SMTP_FROM, to: addr, subject: `[AMS] ${subject}`, text })));
}

async function sendLine(to: string[], text: string) {
  // LINE allows up to 500 recipients per multicast and 5,000 characters per text message
  for (let i = 0; i < to.length; i += 500) {
    const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
      body: JSON.stringify({ to: to.slice(i, i + 500), messages: [{ type: "text", text: text.slice(0, 5000) }] }),
    });
    if (!res.ok) throw new Error(`LINE ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** Deliver one event according to the settings. Returns how many users were targeted. Never throws. */
export async function notify(input: NotifyInput): Promise<number> {
  try {
    const settings = await getSettings();
    const rule = settings["notify.events"][input.event];
    if (!rule.enabled || !meetsPriority(input.priority, rule.minPriority)) return 0;

    const ids = await resolveRecipients(rule.recipients, input.related);
    if (input.actorId) ids.delete(input.actorId);
    if (!ids.size) return 0;

    if (input.dedupeKey) {
      const { count } = await prisma.notificationDispatch.createMany({ data: [{ key: input.dedupeKey }], skipDuplicates: true });
      if (!count) return 0;
    }

    const enabled = settings["notify.channels"];
    const ready = channelReady();
    const sendVia = (c: Channel) => rule.channels.includes(c) && enabled[c] && ready[c];
    const userIds = [...ids];

    if (sendVia("inApp")) {
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({ userId, event: input.event, title: input.title, body: input.body ?? null, href: input.href ?? null })),
      });
    }
    if (sendVia("email") || sendVia("line")) {
      const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true, lineUserId: true } });
      const text = [input.title, input.body, absoluteUrl(input.href)].filter(Boolean).join("\n");
      const jobs: Promise<void>[] = [];
      if (sendVia("email")) jobs.push(sendEmail(users.map((u) => u.email), input.title, text));
      if (sendVia("line")) {
        const lineIds = users.map((u) => u.lineUserId).filter((x): x is string => !!x);
        if (lineIds.length) jobs.push(sendLine(lineIds, text));
      }
      const failed = (await Promise.allSettled(jobs)).filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed.length) {
        await logAction({ action: "NOTIFY_FAILED", module: "notification", details: { event: input.event, errors: failed.map((f) => String(f.reason).slice(0, 300)) } });
      }
    }
    return ids.size;
  } catch (e) {
    await logAction({ action: "NOTIFY_FAILED", module: "notification", details: { event: input.event, error: String(e).slice(0, 300) } }).catch(() => {});
    return 0;
  }
}

/** Fire-and-forget from a server action: runs after the response, so a slow mail server never delays the user. */
export function queueNotify(input: NotifyInput) {
  after(() => notify(input));
}

/** Send a test message on one channel to one user (settings page). Throws with the provider error. */
export async function sendTest(channel: Channel, user: { id: string; email: string; lineUserId: string | null }) {
  const title = "ทดสอบการแจ้งเตือน";
  const body = "หากได้รับข้อความนี้ แสดงว่าตั้งค่าช่องทางนี้ถูกต้องแล้ว";
  if (channel === "inApp") await prisma.notification.create({ data: { userId: user.id, event: "TEST", title, body, href: "/admin/settings" } });
  if (channel === "email") await sendEmail([user.email], title, body);
  if (channel === "line") {
    if (!user.lineUserId) throw new Error("ยังไม่ได้ระบุ LINE User ID ในโปรไฟล์ของคุณ");
    await sendLine([user.lineUserId], `${title}\n${body}`);
  }
}
