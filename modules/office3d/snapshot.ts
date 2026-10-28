import "server-only";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { campaignScope, scopeLocationIds } from "@/modules/audits/service";
import { ticketAbilities } from "@/modules/tickets/workflow";
import { getActiveLayout } from "./layout";
import { isAssetModel } from "./models";
import { ACTIVE_TICKET_STATUSES, buildMarkers, countOpen, matchAssets, sceneTicket, seatAgents, type OfficeSnapshot, type SceneAudit } from "./scene";

type Viewer = { id: string; role: string | null | undefined };

/** The stock take being counted that this viewer may see (latest first), with its tallies. */
async function currentAudit(viewer: Viewer): Promise<SceneAudit | null> {
  if (!can(viewer.role, "audit", "view")) return null;
  const campaign = await prisma.auditCampaign.findFirst({ where: { status: "IN_PROGRESS", ...campaignScope(viewer) }, orderBy: { startDate: "desc" } });
  if (!campaign) return null;
  const [scope, groups] = await Promise.all([
    scopeLocationIds(campaign),
    prisma.auditRecord.groupBy({ by: ["result"], where: { campaignId: campaign.id }, _count: { _all: true } }),
  ]);
  const expected = await prisma.asset.count({ where: { deletedAt: null, status: { not: "DISPOSED" }, locationId: { in: [...scope] } } });
  const tally = { MATCHED: 0, RELOCATED: 0, MISSING: 0, UNREGISTERED: 0 };
  for (const g of groups) tally[g.result] = g._count._all;
  return { campaignId: campaign.id, title: campaign.title, expected, tally };
}

/** Current state of the office for one viewer (IMPLEMENTATION.md §6.3). Ticket titles are hidden unless the viewer may open the ticket. */
export async function buildSnapshot(viewer: Viewer): Promise<OfficeSnapshot> {
  const [layout, lastEvent, people, avatars, ticketRows, locations, audit] = await Promise.all([
    getActiveLayout(),
    prisma.sceneEvent.findFirst({ orderBy: { id: "desc" }, select: { id: true } }),
    prisma.user.findMany({ where: { deletedAt: null, banned: false }, select: { id: true, name: true, role: true } }),
    prisma.sceneAvatar.findMany({ select: { userId: true, model: true, deskSlot: true } }),
    prisma.ticket.findMany({
      where: { status: { in: ACTIVE_TICKET_STATUSES } },
      select: { id: true, ticketNumber: true, title: true, status: true, priority: true, reporterId: true, assignedTechId: true, assetId: true, dueAt: true, onHoldReason: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.location.findMany({
      where: { deletedAt: null, sceneSlot: { not: null } },
      select: {
        sceneSlot: true,
        assets: { where: { deletedAt: null }, select: { id: true, assetCode: true, name: true, status: true, category: { select: { sceneModel: true } } } },
      },
    }),
    currentAudit(viewer),
  ]);

  const now = Date.now();
  const tickets = ticketRows.map((t) => sceneTicket({ ...t, dueAt: t.dueAt?.toISOString() ?? null, canView: ticketAbilities(viewer, t).view }, now));

  const sceneModel = (m: string | null) => (m && isAssetModel(m) ? m : "generic_equipment");
  const itemOf = matchAssets(
    layout.config.items,
    locations.map((l) => ({ sceneSlot: l.sceneSlot as string, assets: l.assets.map((a) => ({ id: a.id, assetCode: a.assetCode, sceneModel: sceneModel(a.category.sceneModel) })) })),
  );
  const assetById = new Map(locations.flatMap((l) => l.assets).map((a) => [a.id, a]));
  const showAssets = can(viewer.role, "asset", "view");
  const assets = [...itemOf].map(([itemId, assetId]) => {
    const a = assetById.get(assetId)!;
    return { id: a.id, assetCode: showAssets ? a.assetCode : null, name: showAssets ? a.name : null, status: a.status, itemId };
  });

  const agents = seatAgents({ items: layout.config.items, people: people.map((p) => ({ ...p, role: p.role ?? "user" })), avatars, tickets });

  return {
    lastEventId: lastEvent ? lastEvent.id.toString() : null,
    layoutId: layout.id,
    layout: layout.config,
    agents,
    tickets,
    assets,
    markers: buildMarkers(agents, tickets),
    openCount: countOpen(tickets),
    audit,
  };
}
