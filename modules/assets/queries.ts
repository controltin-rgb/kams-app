import "server-only";
import { prisma } from "@/lib/prisma";
import { listLocations } from "@/modules/master/queries";

const toIsoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function listAssets() {
  const [rows, locations] = await Promise.all([
    prisma.asset.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        owner: { select: { name: true } },
        department: { select: { name: true } },
      },
    }),
    listLocations(),
  ]);
  const pathOf = new Map(locations.map((l) => [l.id, l.path]));

  return rows.map((a) => ({
    id: a.id,
    assetCode: a.assetCode,
    name: a.name,
    brand: a.brand ?? "",
    model: a.model ?? "",
    serialNumber: a.serialNumber ?? "",
    categoryId: a.category.id,
    category: a.category.name,
    status: a.status,
    condition: a.condition,
    owner: a.owner?.name ?? "",
    department: a.department?.name ?? "",
    location: a.locationId ? (pathOf.get(a.locationId) ?? "") : "",
    purchaseDate: toIsoDate(a.purchaseDate),
    warrantyExpiry: toIsoDate(a.warrantyExpiry),
    cost: a.cost?.toString() ?? "",
  }));
}
export type AssetRow = Awaited<ReturnType<typeof listAssets>>[number];

export async function getAsset(id: string) {
  const asset = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: { include: { propertyDefs: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } } },
      owner: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      properties: true,
      history: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!asset) return null;

  const actorIds = [...new Set(asset.history.map((h) => h.actorId).filter((x): x is string => !!x))];
  const [actors, locations] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }),
    listLocations(),
  ]);
  const actorName = new Map(actors.map((u) => [u.id, u.name]));

  return {
    ...asset,
    cost: asset.cost?.toString() ?? null,
    purchaseDate: toIsoDate(asset.purchaseDate),
    warrantyExpiry: toIsoDate(asset.warrantyExpiry),
    locationPath: asset.locationId ? (locations.find((l) => l.id === asset.locationId)?.path ?? null) : null,
    propertyValues: Object.fromEntries(asset.properties.map((p) => [p.key, p.value])) as Record<string, string>,
    history: asset.history.map((h) => ({ ...h, actorName: h.actorId ? (actorName.get(h.actorId) ?? null) : null })),
  };
}
export type AssetDetail = NonNullable<Awaited<ReturnType<typeof getAsset>>>;

/** Options for asset forms (create/edit/bulk/import) */
export async function getAssetFormOptions() {
  const [categories, locations, departments, users] = await Promise.all([
    prisma.assetCategory.findMany({
      orderBy: { codePrefix: "asc" },
      include: { propertyDefs: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
    }),
    listLocations(),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { banned: false }, orderBy: { name: "asc" }, select: { id: true, name: true, username: true } }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      codePrefix: c.codePrefix,
      propertyDefs: c.propertyDefs.map((p) => ({ key: p.key, label: p.label, type: p.type, required: p.required, options: p.options })),
    })),
    locations: locations.map((l) => ({ value: l.id, label: l.path })),
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    users: users.map((u) => ({ value: u.id, label: u.username ? `${u.name} (@${u.username})` : u.name })),
  };
}
export type AssetFormOptions = Awaited<ReturnType<typeof getAssetFormOptions>>;

/** Minimal public info for the QR scan page — no owner or history. */
export async function getPublicAsset(assetCode: string) {
  const asset = await prisma.asset.findFirst({
    where: { assetCode, deletedAt: null },
    select: { id: true, assetCode: true, name: true, brand: true, model: true, status: true, category: { select: { name: true } } },
  });
  return asset;
}
