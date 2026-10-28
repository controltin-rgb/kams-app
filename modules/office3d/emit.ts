import "server-only";
import type { Prisma, Ticket } from "@/generated/prisma/client";
import type { AssetStatus, AuditResult } from "@/generated/prisma/enums";
import { assetEventPayload, auditEventPayload, moveEventPayload, PM_MAX_SLOTS, pmEventPayload, ticketEventPayload, type MoveEventType, type PmEventType, type TicketEventType } from "./events";

type Tx = Pick<Prisma.TransactionClient, "sceneEvent">;

/**
 * Outbox for the 3D Office (IMPLEMENTATION.md §6.2): call inside the action's existing transaction so the scene
 * only ever shows what was committed. Payloads go through zod, which keeps only the fields the scene needs.
 */
export async function emitTicketEvent(tx: Tx, type: TicketEventType, ticket: Ticket, actorId: string | null) {
  const payload = ticketEventPayload.parse({
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    reporterId: ticket.reporterId,
    assignedTechId: ticket.assignedTechId,
    assetId: ticket.assetId,
    dueAt: ticket.dueAt?.toISOString() ?? null,
    onHoldReason: ticket.onHoldReason,
  });
  await tx.sceneEvent.create({ data: { type, actorId, subjectType: "TICKET", subjectId: ticket.id, payload } });
}

export async function emitAssetStatusEvent(tx: Tx, assetId: string, status: AssetStatus, actorId: string | null) {
  const payload = assetEventPayload.parse({ assetId, status });
  await tx.sceneEvent.create({ data: { type: "ASSET_STATUS_CHANGED", actorId, subjectType: "ASSET", subjectId: assetId, payload } });
}

/**
 * A swap or claim. Emit it before the assets change in the same transaction: their ASSET_STATUS_CHANGED events then
 * come after it, and the office waits for the scene to carry the asset before changing its light.
 */
export async function emitMoveEvent(
  tx: Pick<Prisma.TransactionClient, "sceneEvent" | "asset">,
  type: MoveEventType,
  move: { refId: string; docNumber: string; outAssetId: string | null; inAssetId: string | null },
  actorId: string | null,
) {
  const carried = move.outAssetId ?? move.inAssetId;
  const asset = carried ? await tx.asset.findUnique({ where: { id: carried }, select: { category: { select: { sceneModel: true } } } }) : null;
  const payload = moveEventPayload.parse({ ...move, model: asset?.category.sceneModel ?? null, performerId: actorId });
  const subjectType = type.startsWith("CLAIM") ? "CLAIM" : "SWAP";
  await tx.sceneEvent.create({ data: { type, actorId, subjectType, subjectId: move.refId, payload } });
}

type SlotTx = Pick<Prisma.TransactionClient, "location" | "asset">;

/** Scene slots of a PM schedule: the asset's place, then every bound location under the schedule's location (name order). */
async function pmSlots(tx: SlotTx, schedule: { assetId: string | null; locationId: string | null }) {
  const slots: string[] = [];
  if (schedule.assetId) {
    const asset = await tx.asset.findUnique({ where: { id: schedule.assetId }, select: { location: { select: { sceneSlot: true } } } });
    if (asset?.location?.sceneSlot) slots.push(asset.location.sceneSlot);
  }
  if (schedule.locationId) {
    const all = await tx.location.findMany({ where: { deletedAt: null }, select: { id: true, parentId: true, name: true, sceneSlot: true } });
    const under = new Set([schedule.locationId]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const l of all) {
        if (!l.parentId || !under.has(l.parentId) || under.has(l.id)) continue;
        under.add(l.id);
        grew = true;
      }
    }
    const bound = all.filter((l) => under.has(l.id) && l.sceneSlot).sort((a, b) => a.name.localeCompare(b.name, "th"));
    for (const l of bound) if (!slots.includes(l.sceneSlot!)) slots.push(l.sceneSlot!);
  }
  return slots.slice(0, PM_MAX_SLOTS);
}

/** A PM run started (the technician walks the round) or done. */
export async function emitPmEvent(
  tx: SlotTx & Pick<Prisma.TransactionClient, "sceneEvent">,
  type: PmEventType,
  run: { id: string; schedule: { title: string; assetId: string | null; locationId: string | null; assignedTechId: string | null } },
  actorId: string | null,
  failed: number | null = null,
) {
  const payload = pmEventPayload.parse({
    runId: run.id,
    title: run.schedule.title,
    assetId: run.schedule.assetId,
    slots: type === "PM_STARTED" ? await pmSlots(tx, run.schedule) : [],
    technicianId: actorId ?? run.schedule.assignedTechId,
    failed,
  });
  await tx.sceneEvent.create({ data: { type, actorId, subjectType: "PM", subjectId: run.id, payload } });
}

/** A stock-take scan, with where it happened and the campaign's tallies after it. */
export async function emitAuditScanEvent(
  tx: Pick<Prisma.TransactionClient, "sceneEvent" | "location" | "auditRecord">,
  scan: { campaignId: string; result: AuditResult; assetId: string | null; actualLocationId: string | null; expectedLocationId: string | null; scannedById: string },
) {
  const where = scan.actualLocationId ?? scan.expectedLocationId;
  const [location, groups] = await Promise.all([
    where ? tx.location.findUnique({ where: { id: where }, select: { sceneSlot: true } }) : null,
    tx.auditRecord.groupBy({ by: ["result"], where: { campaignId: scan.campaignId }, _count: { _all: true } }),
  ]);
  const tally = { MATCHED: 0, RELOCATED: 0, MISSING: 0, UNREGISTERED: 0 };
  for (const g of groups) tally[g.result] = g._count._all;
  const payload = auditEventPayload.parse({
    campaignId: scan.campaignId,
    result: scan.result,
    assetId: scan.assetId,
    slot: location?.sceneSlot ?? null,
    scannedById: scan.scannedById,
    tally,
  });
  await tx.sceneEvent.create({ data: { type: "AUDIT_SCAN", actorId: scan.scannedById, subjectType: "AUDIT", subjectId: scan.campaignId, payload } });
}
