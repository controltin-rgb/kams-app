import "server-only";
import { slaState } from "@/components/ticket-badges";
import type { AssetStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { monthStart, type MonthRange } from "./month";

const DAY = 86_400_000;
const OPEN_TICKET = ["OPEN", "IN_PROGRESS", "ON_HOLD"] as const;
const thMonth = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", month: "short", year: "2-digit" });

type Viewer = { id: string };


/** Counts per Bangkok month for the 12 months ending at the selected month. */
async function monthlySeries(range: MonthRange, table: "Asset" | "Ticket") {
  const { year: y, monthNo: mo } = range;
  const from = monthStart(y, mo - 11);
  const rows =
    table === "Asset"
      ? await prisma.$queryRaw<{ m: string; n: bigint }[]>`
          SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM') AS m, count(*) AS n
          FROM "Asset" WHERE "createdAt" >= ${from} AND "createdAt" < ${range.lt} AND "deletedAt" IS NULL GROUP BY 1`
      : await prisma.$queryRaw<{ m: string; n: bigint }[]>`
          SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM') AS m, count(*) AS n
          FROM "Ticket" WHERE "createdAt" >= ${from} AND "createdAt" < ${range.lt} GROUP BY 1`;
  const byMonth = new Map(rows.map((r) => [r.m, Number(r.n)]));
  return Array.from({ length: 12 }, (_, i) => {
    const d = monthStart(y, mo - 11 + i);
    const key = new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);
    return { label: thMonth.format(d), value: byMonth.get(key) ?? 0 };
  });
}

/** Organisation-wide numbers for admins/managers (report:view). */
export async function orgOverview(range: MonthRange) {
  const now = new Date();
  const today = new Date(`${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)}T00:00:00Z`);
  const inMonth = { gte: range.gte, lt: range.lt };
  const live: Prisma.AssetWhereInput = { deletedAt: null };

  const [
    byStatus,
    byCategory,
    categories,
    newAssets,
    warrantySoon,
    warrantyExpired,
    openTickets,
    overdueTickets,
    ticketsOpened,
    ticketsClosed,
    repairCost,
    pmDue,
    pmOverdue,
    pmDone,
    claimsOpen,
    claimsLate,
    claimsSent,
    transfers,
    assetSeries,
    ticketSeries,
    overdueList,
  ] = await Promise.all([
    prisma.asset.groupBy({ by: ["status"], where: live, _count: true }),
    prisma.asset.groupBy({ by: ["categoryId"], where: { ...live, status: { not: "DISPOSED" } }, _count: true }),
    prisma.assetCategory.findMany({ select: { id: true, name: true } }),
    prisma.asset.count({ where: { ...live, createdAt: inMonth } }),
    prisma.asset.count({ where: { ...live, status: { not: "DISPOSED" }, warrantyExpiry: { gte: today, lte: new Date(today.getTime() + 30 * DAY) } } }),
    prisma.asset.count({ where: { ...live, status: { in: ["ACTIVE", "IN_USE"] }, warrantyExpiry: { lt: today } } }),
    prisma.ticket.count({ where: { status: { in: [...OPEN_TICKET] } } }),
    prisma.ticket.count({ where: { status: { in: [...OPEN_TICKET] }, dueAt: { lt: now } } }),
    prisma.ticket.count({ where: { createdAt: inMonth } }),
    prisma.ticket.count({ where: { closedAt: inMonth } }),
    prisma.ticket.aggregate({ where: { closedAt: inMonth, status: "CLOSED" }, _sum: { repairCost: true } }),
    prisma.pmRun.count({ where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] }, dueDate: { lte: new Date(today.getTime() + 7 * DAY) } } }),
    prisma.pmRun.count({ where: { status: "OVERDUE" } }),
    prisma.pmRun.count({ where: { status: "DONE", doneAt: inMonth } }),
    prisma.externalClaim.count({ where: { status: { in: ["SENT", "IN_REPAIR"] } } }),
    prisma.externalClaim.count({ where: { status: { in: ["SENT", "IN_REPAIR"] }, expectedReturnDate: { lt: today } } }),
    prisma.externalClaim.count({ where: { createdAt: inMonth } }),
    prisma.assetTransfer.count({ where: { createdAt: inMonth } }),
    monthlySeries(range, "Asset"),
    monthlySeries(range, "Ticket"),
    prisma.ticket.findMany({
      where: { status: { in: [...OPEN_TICKET] }, dueAt: { lt: now } },
      orderBy: { dueAt: "asc" },
      take: 5,
      select: { id: true, ticketNumber: true, title: true, priority: true, dueAt: true, assignedTech: { select: { name: true } } },
    }),
  ]);

  const status = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Partial<Record<AssetStatus, number>>;
  const total = byStatus.reduce((n, s) => n + (s.status === "DISPOSED" ? 0 : s._count), 0);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  return {
    assets: {
      total,
      status,
      newThisMonth: newAssets,
      inUse: (status.IN_USE ?? 0) + (status.ACTIVE ?? 0),
      byCategory: byCategory.map((c) => ({ label: catName.get(c.categoryId) ?? "-", value: c._count })).sort((a, b) => b.value - a.value),
      warrantySoon,
      warrantyExpired,
    },
    tickets: { open: openTickets, overdue: overdueTickets, opened: ticketsOpened, closed: ticketsClosed, repairCost: repairCost._sum.repairCost?.toString() ?? "0", overdueList },
    pm: { due: pmDue, overdue: pmOverdue, done: pmDone },
    claims: { open: claimsOpen, late: claimsLate, sent: claimsSent },
    activity: { registered: newAssets, transfers, ticketsOpened, ticketsClosed, pmDone, claimsSent },
    series: { assets: assetSeries, tickets: ticketSeries },
  };
}
export type OrgOverview = Awaited<ReturnType<typeof orgOverview>>;

/** Work assigned to a technician: open tickets and PM runs. */
export async function myWork(user: Viewer) {
  const now = Date.now();
  const [tickets, runs] = await Promise.all([
    prisma.ticket.findMany({
      where: { assignedTechId: user.id, status: { in: [...OPEN_TICKET] } },
      orderBy: [{ dueAt: "asc" }],
      select: { id: true, ticketNumber: true, title: true, priority: true, status: true, dueAt: true },
    }),
    prisma.pmRun.findMany({
      where: { schedule: { assignedTechId: user.id }, status: { in: ["SCHEDULED", "IN_PROGRESS", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
      take: 20,
      select: { id: true, dueDate: true, status: true, schedule: { select: { title: true } } },
    }),
  ]);
  return {
    tickets: tickets.map((t) => ({ ...t, sla: slaState(t.dueAt, t.status, now) })),
    overdueTickets: tickets.filter((t) => slaState(t.dueAt, t.status, now) === "overdue").length,
    runs: runs.map((r) => ({ id: r.id, title: r.schedule.title, dueDate: r.dueDate.toISOString().slice(0, 10), status: r.status })),
    overdueRuns: runs.filter((r) => r.status === "OVERDUE").length,
  };
}

/** What a regular user holds and has reported. */
export async function myItems(user: Viewer) {
  const [assets, tickets, openCount] = await Promise.all([
    prisma.asset.findMany({
      where: { ownerId: user.id, deletedAt: null, status: { not: "DISPOSED" } },
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true, status: true },
    }),
    prisma.ticket.findMany({
      where: { reporterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, ticketNumber: true, title: true, status: true, createdAt: true },
    }),
    prisma.ticket.count({ where: { reporterId: user.id, status: { in: [...OPEN_TICKET] } } }),
  ]);
  return { assets, tickets, openTickets: openCount };
}

/** Stock-take campaigns an auditor is assigned to and can scan now. */
export async function myCampaigns(user: Viewer) {
  return prisma.auditCampaign.findMany({
    where: { auditors: { some: { userId: user.id } }, status: "IN_PROGRESS" },
    orderBy: { endDate: "asc" },
    select: { id: true, title: true, endDate: true, _count: { select: { records: true } } },
  });
}
