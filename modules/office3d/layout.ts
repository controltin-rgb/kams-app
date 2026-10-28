import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SceneLayoutConfig } from "./models";
import { withItemIds } from "./scene";

// turbopackIgnore: runtime-only path, keeps output tracing from including the whole project
const ROOT = path.resolve(/* turbopackIgnore: true */ process.env.MODELS_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "3dmodels"));

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const placement = z.object({ position: vec3, rotationY: z.number() });
const base = z.object({ version: z.number(), shell: z.string(), zones: z.record(z.string(), placement), waypoints: z.array(vec3) });

/** office_layout.json as shipped with the models (items without ids) */
const fileSchema = base.extend({ items: z.array(placement.extend({ model: z.string() })) });
/** SceneLayout.config */
export const layoutConfigSchema = base.extend({ items: z.array(placement.extend({ id: z.string(), model: z.string() })) });

/** Default layout shipped with the models, with item ids (also the seed for SceneLayout). */
export async function readDefaultLayout(): Promise<SceneLayoutConfig> {
  const file = fileSchema.parse(JSON.parse(await readFile(path.join(ROOT, "office_layout.json"), "utf8")));
  return { ...file, items: withItemIds(file.items) };
}

/** Active SceneLayout, or the shipped layout when none is saved yet. */
export async function getActiveLayout(): Promise<{ id: string | null; config: SceneLayoutConfig }> {
  const row = await prisma.sceneLayout.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } });
  if (row) {
    const parsed = layoutConfigSchema.safeParse(row.config);
    if (parsed.success) return { id: row.id, config: parsed.data };
  }
  return { id: null, config: await readDefaultLayout() };
}
