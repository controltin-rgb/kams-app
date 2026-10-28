import "server-only";
import type { LabelTemplate } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils/date";
import { listLocations } from "@/modules/master/queries";
import { labelDesignSchema, paperPresets, type LabelData, type LabelDesign, type LabelLayout } from "./design";

function layoutOf(t: LabelTemplate): LabelLayout {
  return {
    pageWidthMm: Number(t.pageWidthMm),
    pageHeightMm: Number(t.pageHeightMm),
    labelWidthMm: Number(t.labelWidthMm),
    labelHeightMm: Number(t.labelHeightMm),
    columns: t.columns,
    rows: t.rows,
    marginTopMm: Number(t.marginTopMm),
    marginLeftMm: Number(t.marginLeftMm),
    gapXMm: Number(t.gapXMm),
    gapYMm: Number(t.gapYMm),
  };
}

function designOf(t: LabelTemplate): LabelDesign {
  const parsed = labelDesignSchema.safeParse(t.design);
  return parsed.success ? parsed.data : { elements: [] };
}

export async function listTemplates() {
  const rows = await prisma.labelTemplate.findMany({ where: { deletedAt: null }, orderBy: [{ kind: "asc" }, { isDefault: "desc" }, { name: "asc" }] });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    kind: t.kind,
    paper: paperPresets[t.paperPreset]?.label ?? t.paperPreset,
    size: `${Number(t.labelWidthMm)}×${Number(t.labelHeightMm)} มม.`,
    perSheet: t.columns * t.rows,
    isDefault: t.isDefault,
    updatedAt: t.updatedAt.toISOString(),
  }));
}
export type TemplateRow = Awaited<ReturnType<typeof listTemplates>>[number];

export async function getTemplate(id: string) {
  const t = await prisma.labelTemplate.findFirst({ where: { id, deletedAt: null } });
  if (!t) return null;
  return { id: t.id, name: t.name, kind: t.kind, paperPreset: t.paperPreset, isDefault: t.isDefault, layout: layoutOf(t), design: designOf(t) };
}
export type TemplateDetail = NonNullable<Awaited<ReturnType<typeof getTemplate>>>;

export async function templatesForPrint() {
  const rows = await prisma.labelTemplate.findMany({ where: { deletedAt: null }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  return rows.map((t) => ({ id: t.id, name: t.name, kind: t.kind, isDefault: t.isDefault, layout: layoutOf(t), design: designOf(t) }));
}
export type PrintTemplate = Awaited<ReturnType<typeof templatesForPrint>>[number];

/** Display values for asset labels, in the order of `ids`. */
export async function labelDataForAssets(ids: string[]): Promise<(LabelData & { id: string })[]> {
  const [assets, locations, settings] = await Promise.all([
    prisma.asset.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { category: { select: { name: true } }, owner: { select: { name: true } }, department: { select: { name: true } } },
    }),
    listLocations(),
    getSettings(),
  ]);
  const path = new Map(locations.map((l) => [l.id, l.path]));
  const byId = new Map(assets.map((a) => [a.id, a]));
  return ids
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .map((a) => ({
      id: a.id,
      assetCode: a.assetCode,
      name: a.name,
      category: a.category.name,
      brandModel: [a.brand, a.model].filter(Boolean).join(" "),
      serialNumber: a.serialNumber ?? "",
      location: a.locationId ? (path.get(a.locationId) ?? "") : "",
      owner: a.owner?.name ?? "",
      department: a.department?.name ?? "",
      purchaseDate: a.purchaseDate ? formatDate(a.purchaseDate) : "",
      orgName: settings["org.name"],
    }));
}

/** Asset picker options for printing */
export async function printableAssets() {
  const rows = await prisma.asset.findMany({
    where: { deletedAt: null, status: { not: "DISPOSED" } },
    orderBy: { assetCode: "asc" },
    select: { id: true, assetCode: true, name: true, category: { select: { name: true } } },
  });
  return rows.map((a) => ({ value: a.id, label: `${a.assetCode} ${a.name} · ${a.category.name}` }));
}
