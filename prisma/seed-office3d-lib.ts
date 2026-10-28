import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "../generated/prisma/client";
import { isAssetModel, type LayoutItem } from "../modules/office3d/models";
import { slotOptions, withItemIds } from "../modules/office3d/scene";

/** Default 3D model per category code prefix (IMPLEMENTATION.md §4) */
const sceneModels: Record<string, string> = {
  PC: "pc_tower",
  AIO: "monitor",
  MON: "monitor",
  NB: "laptop",
  UPS: "ups",
  PRT: "printer_mfp",
  AC: "ac_wall",
  NET: "network_switch",
  AP: "wifi_ap",
  KB: "keyboard",
  MSE: "mouse",
  TEL: "ip_phone",
  PJ: "projector",
  TAB: "tablet",
  SCN: "barcode_scanner",
};

/**
 * 3D Office seed (idempotent): active SceneLayout from office_layout.json, AssetCategory.sceneModel defaults,
 * and — only while no location is bound yet — bind locations to scene slots by the assets they hold.
 */
export async function seedOffice3d(prisma: PrismaClient) {
  const file = path.join(process.env.MODELS_DIR ?? path.join(process.cwd(), "storage", "3dmodels"), "office_layout.json");
  const raw = JSON.parse(await readFile(file, "utf8")) as { items: Omit<LayoutItem, "id">[] } & Record<string, unknown>;
  const items = withItemIds(raw.items);

  if (!(await prisma.sceneLayout.findFirst({ where: { isActive: true } }))) {
    await prisma.sceneLayout.create({ data: { name: "Default Office", isActive: true, config: { ...raw, items } } });
    console.log(`+ 3D Office layout (${items.length} items)`);
  }

  for (const c of await prisma.assetCategory.findMany({ where: { sceneModel: null } })) {
    const model = sceneModels[c.codePrefix];
    if (!model) continue;
    await prisma.assetCategory.update({ where: { id: c.id }, data: { sceneModel: model } });
    console.log(`+ category ${c.codePrefix} → ${model}`);
  }

  if (await prisma.location.findFirst({ where: { sceneSlot: { not: null } } })) return;
  const locations = await prisma.location.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, assets: { where: { deletedAt: null }, select: { category: { select: { sceneModel: true } } } } },
  });
  const free = locations.map((l) => ({ ...l, models: l.assets.map((a) => a.category.sceneModel).filter((m): m is string => !!m && isAssetModel(m)) }));
  // Greedy: each slot takes the unbound location that fills most of its asset items
  for (const slot of slotOptions(items)) {
    const score = (have: string[]) => {
      const pool = [...have];
      return slot.models.filter((m) => {
        const i = pool.indexOf(m);
        if (i >= 0) pool.splice(i, 1);
        return i >= 0;
      }).length;
    };
    const best = free.map((l) => ({ l, s: score(l.models) })).sort((a, b) => b.s - a.s)[0];
    if (!best || best.s === 0) continue;
    await prisma.location.update({ where: { id: best.l.id }, data: { sceneSlot: slot.id } });
    free.splice(free.indexOf(best.l), 1);
    console.log(`+ location "${best.l.name}" → ${slot.id}`);
  }
}
