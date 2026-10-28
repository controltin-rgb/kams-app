import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { notify } from "./service";

const DAY = 86_400_000;

/** Today (Bangkok) as a UTC-midnight Date, matching @db.Date columns. */
function bangkokToday() {
  return new Date(`${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)}T00:00:00Z`);
}

/**
 * Time-based notifications. Each reminder has a dedupe key, so running this every hour only notifies
 * about things that became due since the last run.
 */
export async function runReminders() {
  const rules = (await getSettings())["notify.events"];
  const today = bangkokToday();
  const sent: Record<string, number> = {};
  const count = async (key: string, p: Promise<number>) => {
    if (await p) sent[key] = (sent[key] ?? 0) + 1;
  };

  if (rules.TICKET_SLA_OVERDUE.enabled) {
    const tickets = await prisma.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] }, dueAt: { lt: new Date() } },
      select: { id: true, ticketNumber: true, title: true, priority: true, dueAt: true, reporterId: true, assignedTechId: true },
    });
    for (const t of tickets) {
      await count(
        "TICKET_SLA_OVERDUE",
        notify({
          event: "TICKET_SLA_OVERDUE",
          title: `งานซ่อม ${t.ticketNumber} เกิน SLA`,
          body: `${t.title} — กำหนด ${formatDateTime(t.dueAt)}`,
          href: `/tickets/${t.id}`,
          priority: t.priority,
          related: { reporter: t.reporterId, assignee: t.assignedTechId },
          dedupeKey: `SLA:${t.id}:${t.dueAt!.toISOString()}`,
        }),
      );
    }
  }

  if (rules.PM_DUE.enabled) {
    const until = new Date(today.getTime() + (rules.PM_DUE.daysBefore ?? 1) * DAY);
    const runs = await prisma.pmRun.findMany({
      where: { status: "SCHEDULED", dueDate: { gte: today, lte: until } },
      select: { id: true, dueDate: true, schedule: { select: { title: true, assignedTechId: true } } },
    });
    for (const r of runs) {
      await count(
        "PM_DUE",
        notify({
          event: "PM_DUE",
          title: `PM ใกล้ถึงกำหนด: ${r.schedule.title}`,
          body: `ครบกำหนด ${formatDate(r.dueDate)}`,
          href: `/pm/runs/${r.id}`,
          related: { assignee: r.schedule.assignedTechId },
          dedupeKey: `PM_DUE:${r.id}`,
        }),
      );
    }
  }

  if (rules.PM_OVERDUE.enabled) {
    const runs = await prisma.pmRun.findMany({
      where: { status: "OVERDUE" },
      select: { id: true, dueDate: true, schedule: { select: { title: true, assignedTechId: true } } },
    });
    for (const r of runs) {
      await count(
        "PM_OVERDUE",
        notify({
          event: "PM_OVERDUE",
          title: `PM เลยกำหนด: ${r.schedule.title}`,
          body: `กำหนด ${formatDate(r.dueDate)}`,
          href: `/pm/runs/${r.id}`,
          related: { assignee: r.schedule.assignedTechId },
          dedupeKey: `PM_OVERDUE:${r.id}`,
        }),
      );
    }
  }

  if (rules.CLAIM_OVERDUE.enabled) {
    const claims = await prisma.externalClaim.findMany({
      where: { status: { in: ["SENT", "IN_REPAIR"] }, expectedReturnDate: { lt: today } },
      select: { id: true, claimNumber: true, expectedReturnDate: true, asset: { select: { assetCode: true } }, vendor: { select: { name: true } } },
    });
    for (const c of claims) {
      await count(
        "CLAIM_OVERDUE",
        notify({
          event: "CLAIM_OVERDUE",
          title: `เคลม ${c.claimNumber} เกินกำหนดรับคืน`,
          body: `${c.asset.assetCode} ที่ ${c.vendor.name} — กำหนด ${formatDate(c.expectedReturnDate)}`,
          href: `/claims/${c.id}`,
          dedupeKey: `CLAIM:${c.id}:${c.expectedReturnDate!.toISOString().slice(0, 10)}`,
        }),
      );
    }
  }

  if (rules.WARRANTY_EXPIRING.enabled) {
    const until = new Date(today.getTime() + (rules.WARRANTY_EXPIRING.daysBefore ?? 30) * DAY);
    const assets = await prisma.asset.findMany({
      where: { deletedAt: null, status: { not: "DISPOSED" }, warrantyExpiry: { gte: today, lte: until } },
      select: { id: true, assetCode: true, name: true, warrantyExpiry: true },
    });
    for (const a of assets) {
      await count(
        "WARRANTY_EXPIRING",
        notify({
          event: "WARRANTY_EXPIRING",
          title: `ประกัน ${a.assetCode} ใกล้หมด`,
          body: `${a.name} — หมดประกัน ${formatDate(a.warrantyExpiry)}`,
          href: `/assets/${a.id}`,
          dedupeKey: `WARRANTY:${a.id}:${a.warrantyExpiry!.toISOString().slice(0, 10)}`,
        }),
      );
    }
  }

  return sent;
}
