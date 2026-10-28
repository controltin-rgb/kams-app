import "server-only";
import type { AssetStatus, Prisma, TransferItemAction } from "@/generated/prisma/client";
import { saveFile, sniffType } from "@/lib/storage";
import { currentYear, nextSequence } from "@/lib/sequence";
import { emitAssetStatusEvent } from "@/modules/office3d/emit";

type Tx = Prisma.TransactionClient;

export class RuleError extends Error {}

/** Ids of all ACTIVE descendants (children, grandchildren, ...) of an asset. */
export async function activeDescendants(tx: Tx, assetId: string): Promise<string[]> {
  const out: string[] = [];
  let frontier = [assetId];
  while (frontier.length) {
    const rows = await tx.assetRelationship.findMany({ where: { parentId: { in: frontier }, status: "ACTIVE" }, select: { childId: true } });
    frontier = rows.map((r) => r.childId).filter((id) => !out.includes(id) && id !== assetId);
    out.push(...frontier);
  }
  return out;
}

export async function activeParentOf(tx: Tx, assetId: string) {
  return tx.assetRelationship.findFirst({
    where: { childId: assetId, status: "ACTIVE" },
    include: { parent: { select: { id: true, assetCode: true } } },
  });
}

/** True if making `childId` a child of `parentId` would create a cycle (child is an ancestor of parent). */
export async function wouldCreateCycle(tx: Tx, parentId: string, childId: string) {
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === childId) return true;
    seen.add(cursor);
    const rel: { parentId: string } | null = await tx.assetRelationship.findFirst({ where: { childId: cursor, status: "ACTIVE" }, select: { parentId: true } });
    cursor = rel?.parentId ?? null;
  }
  return false;
}

export async function nextDocNumber(tx: Tx, prefix: "HND" | "SWP") {
  const year = currentYear();
  const n = await nextSequence(tx, prefix, year);
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

export type Placement = {
  /** undefined = keep, null = clear */
  ownerId?: string | null;
  locationId?: string | null;
  departmentId?: string | null;
  status?: AssetStatus;
};

/**
 * Move assets (each with its whole ACTIVE bundle) to a new placement, recording transfer items and asset history.
 * Children always follow their parent (CLAUDE.md §8).
 */
export async function placeAssets(
  tx: Tx,
  opts: {
    rootIds: string[];
    to: Placement;
    action: TransferItemAction;
    transferId: string;
    refType: "TRANSFER" | "SWAP";
    actorId: string;
    parentAssetId?: string | null;
  },
) {
  const ids = [...opts.rootIds];
  for (const root of opts.rootIds) ids.push(...(await activeDescendants(tx, root)));
  const assets = await tx.asset.findMany({
    where: { id: { in: ids } },
    select: { id: true, ownerId: true, locationId: true, departmentId: true, status: true },
  });

  for (const a of assets) {
    const next = {
      ownerId: opts.to.ownerId === undefined ? a.ownerId : opts.to.ownerId,
      locationId: opts.to.locationId === undefined ? a.locationId : opts.to.locationId,
      departmentId: opts.to.departmentId === undefined ? a.departmentId : opts.to.departmentId,
      status: opts.to.status ?? a.status,
    };
    await tx.asset.update({ where: { id: a.id }, data: next });
    await tx.assetTransferItem.create({
      data: {
        transferId: opts.transferId,
        assetId: a.id,
        action: opts.action,
        parentAssetId: opts.rootIds.includes(a.id) ? (opts.parentAssetId ?? null) : null,
        fromOwnerId: a.ownerId,
        toOwnerId: next.ownerId,
        fromLocationId: a.locationId,
        toLocationId: next.locationId,
        fromDepartmentId: a.departmentId,
        toDepartmentId: next.departmentId,
        fromStatus: a.status,
        toStatus: next.status,
      },
    });

    const ref = { refType: opts.refType, refId: opts.transferId, actorId: opts.actorId };
    const history: Prisma.AssetHistoryCreateManyInput[] = [];
    if (a.ownerId !== next.ownerId) history.push({ assetId: a.id, event: "ASSIGNED", fromValue: { ownerId: a.ownerId }, toValue: { ownerId: next.ownerId }, ...ref });
    if (a.locationId !== next.locationId) history.push({ assetId: a.id, event: "MOVED", fromValue: { locationId: a.locationId }, toValue: { locationId: next.locationId }, ...ref });
    if (a.status !== next.status) history.push({ assetId: a.id, event: "STATUS_CHANGED", fromValue: { status: a.status }, toValue: { status: next.status }, ...ref });
    if (history.length) await tx.assetHistory.createMany({ data: history });
    if (a.status !== next.status) await emitAssetStatusEvent(tx, a.id, next.status, opts.actorId);
  }
  return assets.length;
}

/** Write a receiver signature (PNG data URL) to storage before the transaction; returns what to attach. */
export async function storeSignature(dataUrl: string) {
  const buffer = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
  if (sniffType(buffer)?.mime !== "image/png") throw new RuleError("ลายเซ็นไม่ถูกต้อง");
  return { storageKey: await saveFile(buffer, "png"), size: buffer.length };
}

export async function attachSignature(tx: Tx, transferId: string, file: { storageKey: string; size: number }, uploadedById: string) {
  await tx.attachment.create({
    data: { storageKey: file.storageKey, filename: "signature.png", mime: "image/png", size: file.size, uploadedById, transferId },
  });
}

/** Statuses that block moving an asset around (it is with a technician, a vendor, or gone). */
export const lockedStatuses: AssetStatus[] = ["IN_MAINTENANCE", "CLAIMING", "DISPOSED"];
