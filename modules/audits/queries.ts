import "server-only";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listLocations } from "@/modules/master/queries";
import { campaignScope, needsDecision, scopeLocationIds } from "./service";

type Viewer = { id: string; role: string | null | undefined };
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function listCampaigns(user: Viewer) {
  const rows = await prisma.auditCampaign.findMany({
    where: campaignScope(user),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { records: true, auditors: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    year: c.year,
    status: c.status,
    startDate: iso(c.startDate)!,
    endDate: iso(c.endDate)!,
    records: c._count.records,
    auditors: c._count.auditors,
  }));
}
export type CampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];

export async function getCampaign(id: string, user: Viewer) {
  const c = await prisma.auditCampaign.findFirst({
    where: { id, ...campaignScope(user) },
    include: { auditors: { include: { user: { select: { id: true, name: true } } } } },
  });
  if (!c) return null;

  const [locations, scope, records] = await Promise.all([
    listLocations(),
    scopeLocationIds(c),
    prisma.auditRecord.findMany({
      where: { campaignId: id },
      orderBy: [{ result: "asc" }, { scannedCode: "asc" }],
      include: { asset: { select: { id: true, name: true, condition: true, status: true } } },
    }),
  ]);
  const path = new Map(locations.map((l) => [l.id, l.path]));
  const expectedCount = await prisma.asset.count({ where: { deletedAt: null, status: { not: "DISPOSED" }, locationId: { in: [...scope] } } });
  const scannerIds = [...new Set(records.map((r) => r.scannedById).filter((x): x is string => !!x))];
  const scanners = await prisma.user.findMany({ where: { id: { in: scannerIds } }, select: { id: true, name: true } });
  const scannerName = new Map(scanners.map((u) => [u.id, u.name]));

  return {
    id: c.id,
    title: c.title,
    year: c.year,
    status: c.status,
    note: c.note,
    startDate: iso(c.startDate)!,
    endDate: iso(c.endDate)!,
    completedAt: c.completedAt,
    closedAt: c.closedAt,
    scopeLocationIds: c.scopeLocationIds,
    scopeNames: c.scopeLocationIds.map((l) => path.get(l) ?? "-"),
    auditors: c.auditors.map((a) => a.user),
    expectedCount,
    records: records.map((r) => ({
      id: r.id,
      assetId: r.assetId,
      scannedCode: r.scannedCode,
      assetName: r.asset?.name ?? "",
      result: r.result,
      condition: r.condition,
      assetCondition: r.asset?.condition ?? null,
      expectedLocation: r.expectedLocationId ? (path.get(r.expectedLocationId) ?? "-") : "",
      actualLocation: r.actualLocationId ? (path.get(r.actualLocationId) ?? "-") : "",
      scannedBy: r.scannedById ? (scannerName.get(r.scannedById) ?? "") : "",
      scannedAt: r.scannedAt?.toISOString() ?? null,
      notes: r.notes ?? "",
      reconciled: r.reconciled,
      decision: r.decision,
      needsDecision: needsDecision(r, r.asset?.condition ?? null),
    })),
    canManage: can(user.role, "audit", "update"),
    canApprove: can(user.role, "audit", "approve"),
  };
}
export type CampaignDetail = NonNullable<Awaited<ReturnType<typeof getCampaign>>>;
export type AuditRecordRow = CampaignDetail["records"][number];

/** Everything the scan page needs offline: locations in scope and a lookup of all registered assets. */
export async function scanPack(campaignId: string) {
  const c = await prisma.auditCampaign.findUnique({ where: { id: campaignId } });
  if (!c) return null;
  const [locations, scope, assets] = await Promise.all([
    listLocations(),
    scopeLocationIds(c),
    prisma.asset.findMany({ where: { deletedAt: null }, select: { id: true, assetCode: true, barcode: true, name: true, locationId: true } }),
  ]);
  return {
    campaign: { id: c.id, title: c.title, status: c.status },
    locations: locations.filter((l) => scope.has(l.id)).map((l) => ({ id: l.id, path: l.path })),
    assets,
    generatedAt: new Date().toISOString(),
  };
}
export type ScanPack = NonNullable<Awaited<ReturnType<typeof scanPack>>>;

export async function campaignFormOptions() {
  const [locations, users] = await Promise.all([
    listLocations(),
    prisma.user.findMany({ where: { banned: false }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
  ]);
  return {
    locations: locations.map((l) => ({ value: l.id, label: l.path })),
    auditors: users.filter((u) => can(u.role, "audit", "scan")).map((u) => ({ value: u.id, label: u.name })),
  };
}
export type CampaignFormOptions = Awaited<ReturnType<typeof campaignFormOptions>>;
