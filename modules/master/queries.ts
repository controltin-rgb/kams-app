import "server-only";
import type { LocationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function listDepartments() {
  const rows = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, assets: { where: { deletedAt: null } } } } },
  });
  return rows.map((d) => ({ id: d.id, name: d.name, code: d.code ?? "", users: d._count.users, assets: d._count.assets }));
}
export type DepartmentRow = Awaited<ReturnType<typeof listDepartments>>[number];

export async function listVendors() {
  const rows = await prisma.vendor.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  return rows.map((v) => ({
    id: v.id,
    name: v.name,
    contact: v.contact ?? "",
    phone: v.phone ?? "",
    email: v.email ?? "",
    address: v.address ?? "",
    note: v.note ?? "",
  }));
}
export type VendorRow = Awaited<ReturnType<typeof listVendors>>[number];

export type LocationNode = {
  id: string;
  name: string;
  type: LocationType;
  parentId: string | null;
  /** 3D Office layout item id */
  sceneSlot: string | null;
  /** Full path, e.g. "อาคาร A / ชั้น 1 / ห้อง 101" */
  path: string;
  depth: number;
  /** ids of this node and all its descendants */
  subtreeIds: string[];
  assets: number;
  children: number;
};

/** All active locations with computed paths, sorted by path (tree order). */
export async function listLocations(): Promise<LocationNode[]> {
  const rows = await prisma.location.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const childrenOf = new Map<string, string[]>();
  for (const r of rows) {
    if (r.parentId && byId.has(r.parentId)) {
      childrenOf.set(r.parentId, [...(childrenOf.get(r.parentId) ?? []), r.id]);
    }
  }

  const pathOf = (id: string, seen = new Set<string>()): string[] => {
    const r = byId.get(id);
    if (!r || seen.has(id)) return [];
    seen.add(id);
    return r.parentId && byId.has(r.parentId) ? [...pathOf(r.parentId, seen), r.name] : [r.name];
  };
  const subtree = (id: string): string[] => [id, ...(childrenOf.get(id) ?? []).flatMap(subtree)];

  return rows
    .map((r) => {
      const parts = pathOf(r.id);
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        parentId: r.parentId,
        sceneSlot: r.sceneSlot,
        path: parts.join(" / "),
        depth: parts.length - 1,
        subtreeIds: subtree(r.id),
        assets: r._count.assets,
        children: childrenOf.get(r.id)?.length ?? 0,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path, "th"));
}

export async function listCategories() {
  const rows = await prisma.assetCategory.findMany({
    orderBy: { codePrefix: "asc" },
    include: { _count: { select: { assets: { where: { deletedAt: null } }, propertyDefs: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    codePrefix: c.codePrefix,
    description: c.description ?? "",
    sceneModel: c.sceneModel,
    assets: c._count.assets,
    properties: c._count.propertyDefs,
  }));
}
export type CategoryRow = Awaited<ReturnType<typeof listCategories>>[number];

export async function getCategoryWithProperties(id: string) {
  return prisma.assetCategory.findUnique({
    where: { id },
    include: { propertyDefs: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
  });
}
export type CategoryWithProperties = NonNullable<Awaited<ReturnType<typeof getCategoryWithProperties>>>;
export type PropertyDefRow = CategoryWithProperties["propertyDefs"][number];
