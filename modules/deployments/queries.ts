import "server-only";
import { prisma } from "@/lib/prisma";
import { listLocations } from "@/modules/master/queries";

async function nameMaps(userIds: (string | null)[], departmentIds: (string | null)[]) {
  const [users, departments, locations] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds.filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { id: { in: departmentIds.filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
    listLocations(),
  ]);
  return {
    user: (id: string | null) => (id ? (users.find((u) => u.id === id)?.name ?? "-") : null),
    department: (id: string | null) => (id ? (departments.find((d) => d.id === id)?.name ?? "-") : null),
    location: (id: string | null) => (id ? (locations.find((l) => l.id === id)?.path ?? "-") : null),
  };
}

export async function listTransfers() {
  const rows = await prisma.assetTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { asset: { select: { assetCode: true } } } }, ticket: { select: { ticketNumber: true } } },
  });
  const names = await nameMaps([...rows.map((r) => r.toOwnerId), ...rows.map((r) => r.performedById)], rows.map((r) => r.toDepartmentId));
  return rows.map((t) => ({
    id: t.id,
    docNumber: t.docNumber,
    type: t.type,
    assets: [...new Set(t.items.map((i) => i.asset.assetCode))].join(", "),
    itemCount: t.items.length,
    toOwner: names.user(t.toOwnerId) ?? "",
    toLocation: names.location(t.toLocationId) ?? "",
    performedBy: names.user(t.performedById) ?? "",
    ticketNumber: t.ticket?.ticketNumber ?? "",
    signed: !!t.signedAt,
    createdAt: t.createdAt.toISOString(),
  }));
}
export type TransferRow = Awaited<ReturnType<typeof listTransfers>>[number];

export async function getTransfer(id: string) {
  const t = await prisma.assetTransfer.findUnique({
    where: { id },
    include: {
      items: { include: { asset: { select: { id: true, assetCode: true, name: true, brand: true, model: true, serialNumber: true } } } },
      attachments: { select: { id: true }, take: 1, orderBy: { createdAt: "desc" } },
      ticket: { select: { id: true, ticketNumber: true, title: true } },
    },
  });
  if (!t) return null;
  const names = await nameMaps(
    [t.toOwnerId, t.performedById, ...t.items.flatMap((i) => [i.fromOwnerId, i.toOwnerId])],
    [t.toDepartmentId, ...t.items.flatMap((i) => [i.fromDepartmentId, i.toDepartmentId])],
  );
  return {
    ...t,
    signatureId: t.attachments[0]?.id ?? null,
    toOwnerName: names.user(t.toOwnerId),
    toLocationPath: names.location(t.toLocationId),
    toDepartmentName: names.department(t.toDepartmentId),
    performedByName: names.user(t.performedById),
    items: t.items.map((i) => ({
      ...i,
      fromOwner: names.user(i.fromOwnerId),
      toOwner: names.user(i.toOwnerId),
      fromLocation: names.location(i.fromLocationId),
      toLocation: names.location(i.toLocationId),
    })),
  };
}
export type TransferDetail = NonNullable<Awaited<ReturnType<typeof getTransfer>>>;

/** Bundle info for the asset page: active parent and active children. */
export async function getBundle(assetId: string) {
  const [parent, children] = await Promise.all([
    prisma.assetRelationship.findFirst({
      where: { childId: assetId, status: "ACTIVE" },
      include: { parent: { select: { id: true, assetCode: true, name: true } } },
    }),
    prisma.assetRelationship.findMany({
      where: { parentId: assetId, status: "ACTIVE" },
      orderBy: { attachedAt: "asc" },
      include: { child: { select: { id: true, assetCode: true, name: true, status: true } } },
    }),
  ]);
  return { parent, children };
}

type Option = { value: string; label: string };

/** Options for deployment forms. "Free" = not part of another bundle. */
export async function deploymentOptions() {
  const [assets, activeChildIds, parentIds, users, departments, locations, tickets] = await Promise.all([
    prisma.asset.findMany({
      where: { deletedAt: null, status: { not: "DISPOSED" } },
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true, status: true, categoryId: true, owner: { select: { name: true } } },
    }),
    prisma.assetRelationship.findMany({ where: { status: "ACTIVE" }, select: { childId: true } }),
    prisma.assetRelationship.findMany({ where: { status: "ACTIVE" }, select: { parentId: true }, distinct: ["parentId"] }),
    prisma.user.findMany({ where: { banned: false }, orderBy: { name: "asc" }, select: { id: true, name: true, username: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listLocations(),
    prisma.ticket.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, ticketNumber: true, title: true },
    }),
  ]);
  const childSet = new Set(activeChildIds.map((r) => r.childId));
  const parentSet = new Set(parentIds.map((r) => r.parentId));
  const label = (a: (typeof assets)[number]) => `${a.assetCode} ${a.name}${a.owner ? ` · ${a.owner.name}` : ""}`;
  const free = assets.filter((a) => !childSet.has(a.id));

  return {
    /** Top-level assets that can be handed over / returned / moved (children travel with them) */
    rootAssets: free.filter((a) => !["IN_MAINTENANCE", "CLAIMING"].includes(a.status)).map((a): Option & { status: string } => ({ value: a.id, label: label(a), status: a.status })),
    /** Free SPARE assets: replacements and new sets */
    spareAssets: free.filter((a) => a.status === "SPARE").map((a): Option & { categoryId: string } => ({ value: a.id, label: label(a), categoryId: a.categoryId })),
    /** Assets that currently have children (for partial swap) */
    bundles: assets.filter((a) => parentSet.has(a.id)).map((a): Option => ({ value: a.id, label: label(a) })),
    /** Top-level assets in use (for full swap) */
    inUseSets: free.filter((a) => ["IN_USE", "ACTIVE", "IN_MAINTENANCE"].includes(a.status)).map((a): Option => ({ value: a.id, label: label(a) })),
    users: users.map((u): Option => ({ value: u.id, label: u.username ? `${u.name} (@${u.username})` : u.name })),
    departments: departments.map((d): Option => ({ value: d.id, label: d.name })),
    locations: locations.map((l): Option => ({ value: l.id, label: l.path })),
    tickets: tickets.map((t): Option => ({ value: t.id, label: `${t.ticketNumber} ${t.title}` })),
  };
}
export type DeploymentOptions = Awaited<ReturnType<typeof deploymentOptions>>;

/** Active children of a bundle (for the partial swap form) */
export async function bundleChildren(parentIds: string[]) {
  const rows = await prisma.assetRelationship.findMany({
    where: { parentId: { in: parentIds }, status: "ACTIVE" },
    include: { child: { select: { id: true, assetCode: true, name: true, categoryId: true } } },
  });
  return rows.map((r) => ({ parentId: r.parentId, value: r.child.id, label: `${r.child.assetCode} ${r.child.name}`, categoryId: r.child.categoryId }));
}
