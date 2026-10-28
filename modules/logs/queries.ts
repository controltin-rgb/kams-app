import "server-only";
import { prisma } from "@/lib/prisma";

export const LOG_ROW_LIMIT = 5000;
const DAY = 86_400_000;

/** Parse ?from=&to= (YYYY-MM-DD, Bangkok days). Defaults to the last 30 days. */
export function logRange(from?: string, to?: string) {
  const valid = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const toDay = valid(to) ?? today;
  const fromDay = valid(from) ?? new Date(new Date(`${toDay}T00:00:00Z`).getTime() - 29 * DAY).toISOString().slice(0, 10);
  return {
    from: fromDay,
    to: toDay,
    // Bangkok midnight = 17:00 UTC the previous day
    gte: new Date(`${fromDay}T00:00:00+07:00`),
    lt: new Date(new Date(`${toDay}T00:00:00+07:00`).getTime() + DAY),
  };
}

export async function listLogs(range: { gte: Date; lt: Date }) {
  const rows = await prisma.systemAuditLog.findMany({
    where: { createdAt: { gte: range.gte, lt: range.lt } },
    orderBy: { createdAt: "desc" },
    take: LOG_ROW_LIMIT + 1,
    include: { user: { select: { name: true, username: true } } },
  });
  const impersonatorIds = [...new Set(rows.map((r) => r.impersonatedBy).filter((x): x is string => !!x))];
  const impersonators = await prisma.user.findMany({ where: { id: { in: impersonatorIds } }, select: { id: true, name: true } });
  const nameOf = new Map(impersonators.map((u) => [u.id, u.name]));

  return {
    truncated: rows.length > LOG_ROW_LIMIT,
    rows: rows.slice(0, LOG_ROW_LIMIT).map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: r.user ? `${r.user.name} (@${r.user.username ?? "-"})` : "",
      impersonatedBy: r.impersonatedBy ? (nameOf.get(r.impersonatedBy) ?? r.impersonatedBy) : "",
      module: r.module,
      action: r.action,
      entityId: r.entityId ?? "",
      details: r.details ? JSON.stringify(r.details) : "",
      ip: r.ip ?? "",
    })),
  };
}
export type LogRow = Awaited<ReturnType<typeof listLogs>>["rows"][number];
