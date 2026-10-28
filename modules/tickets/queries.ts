import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { slaState } from "@/components/ticket-badges";
import { ticketAbilities } from "./workflow";

type Viewer = { id: string; role: string | null | undefined };

/** Tickets a user may see: everything with viewAll, otherwise own reports and assigned work. */
export function ticketScope(user: Viewer): Prisma.TicketWhereInput {
  if (can(user.role, "ticket", "viewAll")) return {};
  return { OR: [{ reporterId: user.id }, { assignedTechId: user.id }] };
}

export async function listTickets(user: Viewer) {
  const now = Date.now();
  const rows = await prisma.ticket.findMany({
    where: ticketScope(user),
    orderBy: { createdAt: "desc" },
    include: {
      asset: { select: { assetCode: true, name: true } },
      reporter: { select: { name: true } },
      assignedTech: { select: { name: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    category: t.category,
    priority: t.priority,
    status: t.status,
    asset: t.asset ? `${t.asset.assetCode} ${t.asset.name}` : "",
    reporter: t.reporter?.name ?? t.reporterName ?? "",
    assignedTech: t.assignedTech?.name ?? "",
    dueAt: t.dueAt?.toISOString() ?? null,
    sla: slaState(t.dueAt, t.status, now),
    createdAt: t.createdAt.toISOString(),
    mine: t.reporterId === user.id,
    assignedToMe: t.assignedTechId === user.id,
  }));
}
export type TicketRow = Awaited<ReturnType<typeof listTickets>>[number];

export async function getTicket(id: string, user: Viewer) {
  const ticket = await prisma.ticket.findFirst({
    where: { id, ...ticketScope(user) },
    include: {
      asset: { select: { id: true, assetCode: true, name: true, status: true, locationId: true } },
      reporter: { select: { id: true, name: true, email: true, phone: true } },
      assignedTech: { select: { id: true, name: true } },
      parts: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      activities: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return null;

  const abilities = ticketAbilities(user, ticket);
  const actorIds = [...new Set(ticket.activities.map((a) => a.actorId).filter((x): x is string => !!x))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const actorName = new Map(actors.map((u) => [u.id, u.name]));

  return {
    ...ticket,
    sla: slaState(ticket.dueAt, ticket.status, Date.now()),
    laborCost: ticket.laborCost.toString(),
    repairCost: ticket.repairCost.toString(),
    parts: ticket.parts.map((p) => ({ ...p, unitCost: p.unitCost.toString(), total: p.unitCost.mul(p.qty).toString() })),
    // Internal notes are hidden from people who cannot work on the ticket (e.g. the reporter)
    activities: ticket.activities
      .filter((a) => !a.internal || abilities.internalNotes)
      .map((a) => ({ ...a, actorName: a.actorId ? (actorName.get(a.actorId) ?? null) : null })),
    abilities,
  };
}
export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicket>>>;

/** Users who can be assigned: roles with ticket:update */
export async function listAssignableTechs() {
  const users = await prisma.user.findMany({ where: { banned: false }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });
  return users.filter((u) => can(u.role, "ticket", "update")).map((u) => ({ value: u.id, label: u.name }));
}

/** Assets a user can report on: all assets for staff, own assets for regular users. */
export async function assetOptionsFor(user: Viewer) {
  const staff = can(user.role, "ticket", "viewAll") || can(user.role, "ticket", "update");
  const assets = await prisma.asset.findMany({
    where: { deletedAt: null, status: { not: "DISPOSED" }, ...(staff ? {} : { ownerId: user.id }) },
    orderBy: { assetCode: "asc" },
    select: { id: true, assetCode: true, name: true },
    take: 2000,
  });
  return assets.map((a) => ({ value: a.id, label: `${a.assetCode} ${a.name}` }));
}
