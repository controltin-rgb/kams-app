import "server-only";
import type { AuditCampaign, Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listLocations } from "@/modules/master/queries";
import { emitAuditScanEvent } from "@/modules/office3d/emit";
import { classifyScan, findAsset, parseScannedCode } from "./scan-logic";
import type { ScanInput } from "./schemas";

type Tx = Prisma.TransactionClient;
type Viewer = { id: string; role: string | null | undefined };

/** Managers/admins see every campaign; auditors only those they are assigned to (CLAUDE.md §6). */
export function campaignScope(user: Viewer): Prisma.AuditCampaignWhereInput {
  if (can(user.role, "audit", "create") || can(user.role, "audit", "approve")) return {};
  return { auditors: { some: { userId: user.id } } };
}

export async function canScanCampaign(user: Viewer, campaignId: string) {
  if (!can(user.role, "audit", "scan")) return false;
  if (can(user.role, "audit", "create")) return true;
  return !!(await prisma.auditCampaignAuditor.findUnique({ where: { campaignId_userId: { campaignId, userId: user.id } } }));
}

/** Location ids covered by a campaign (selected roots and all their descendants). */
export async function scopeLocationIds(campaign: Pick<AuditCampaign, "scopeLocationIds">) {
  const locations = await listLocations();
  const ids = new Set<string>();
  for (const l of locations) if (campaign.scopeLocationIds.includes(l.id)) l.subtreeIds.forEach((x) => ids.add(x));
  return ids;
}

export type ScanOutcome = { clientUuid: string; status: "applied" | "duplicate" | "rejected"; result?: string; assetCode?: string; message?: string };

/**
 * Apply one device scan. Idempotent: the raw scan is stored by clientUuid first; a replayed scan is a no-op.
 * One AuditRecord per code — a newer scan overwrites an older one (e.g. found again in the right room).
 */
export async function applyScan(tx: Tx, campaignId: string, scan: ScanInput, scannedById: string): Promise<ScanOutcome> {
  const inserted = await tx.auditScan.createMany({
    data: [
      {
        campaignId,
        clientUuid: scan.clientUuid,
        scannedCode: scan.code,
        actualLocationId: scan.actualLocationId ?? null,
        condition: scan.condition,
        notes: scan.notes ?? null,
        scannedById,
        scannedAt: new Date(scan.scannedAt),
      },
    ],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return { clientUuid: scan.clientUuid, status: "duplicate" };

  const code = parseScannedCode(scan.code);
  const candidates = await tx.asset.findMany({
    where: { deletedAt: null, OR: [{ assetCode: { equals: code, mode: "insensitive" } }, { barcode: code }] },
    select: { id: true, assetCode: true, barcode: true, locationId: true },
  });
  const asset = findAsset(candidates, code);
  const result = classifyScan(asset, scan.actualLocationId ?? null);
  const key = asset?.assetCode ?? code;
  const scannedAt = new Date(scan.scannedAt);

  const existing = await tx.auditRecord.findUnique({ where: { campaignId_scannedCode: { campaignId, scannedCode: key } } });
  if (existing?.scannedAt && existing.scannedAt > scannedAt) {
    return { clientUuid: scan.clientUuid, status: "applied", result: existing.result, assetCode: key, message: "มีผลสแกนที่ใหม่กว่าอยู่แล้ว" };
  }
  const data = {
    assetId: asset?.id ?? null,
    scannedById,
    expectedLocationId: asset?.locationId ?? null,
    actualLocationId: scan.actualLocationId ?? null,
    condition: scan.condition,
    result,
    notes: scan.notes ?? null,
    scannedAt,
    reconciled: false,
    decision: null,
  };
  await tx.auditRecord.upsert({
    where: { campaignId_scannedCode: { campaignId, scannedCode: key } },
    create: { campaignId, scannedCode: key, ...data },
    update: data,
  });
  await emitAuditScanEvent(tx, { campaignId, result, assetId: data.assetId, actualLocationId: data.actualLocationId, expectedLocationId: data.expectedLocationId, scannedById });
  return { clientUuid: scan.clientUuid, status: "applied", result, assetCode: key };
}

/** Close scanning: every in-scope asset without a record becomes MISSING (CLAUDE.md §8). */
export async function createMissingRecords(tx: Tx, campaign: AuditCampaign) {
  const scope = [...(await scopeLocationIds(campaign))];
  const scanned = await tx.auditRecord.findMany({ where: { campaignId: campaign.id, assetId: { not: null } }, select: { assetId: true } });
  const done = new Set(scanned.map((r) => r.assetId));
  const expected = await tx.asset.findMany({
    where: { deletedAt: null, status: { not: "DISPOSED" }, locationId: { in: scope } },
    select: { id: true, assetCode: true, locationId: true, condition: true },
  });
  const missing = expected.filter((a) => !done.has(a.id));
  if (missing.length) {
    await tx.auditRecord.createMany({
      data: missing.map((a) => ({
        campaignId: campaign.id,
        assetId: a.id,
        scannedCode: a.assetCode,
        expectedLocationId: a.locationId,
        condition: a.condition,
        result: "MISSING" as const,
      })),
      skipDuplicates: true,
    });
  }
  return missing.length;
}

/** Records that do not need a decision: matched and unchanged condition. */
export function needsDecision(r: { result: string; condition: string }, assetCondition: string | null) {
  return r.result !== "MATCHED" || (assetCondition !== null && r.condition !== assetCondition);
}
