"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAction } from "@/lib/audit";
import type { FormState } from "@/lib/form-state";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getActiveLayout, readDefaultLayout } from "./layout";
import type { SceneLayoutConfig } from "./models";

/** Room the editor may place items in (glTF metres, office_shell is 14×10) */
const ROOM = { x: 7, z: 5 };
const LAYOUT_NAME = "Default Office";

/** Only where existing items go: no items are added or removed, so Location.sceneSlot bindings stay valid. */
const movesSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(80),
      x: z.number().min(-ROOM.x).max(ROOM.x),
      z: z.number().min(-ROOM.z).max(ROOM.z),
      rotationY: z.number().min(-360).max(360),
    }),
  )
  .min(1)
  .max(500);
export type LayoutMove = z.input<typeof movesSchema>[number];

const round = (n: number) => Math.round(n * 1000) / 1000;

async function activate(config: SceneLayoutConfig, userId: string, impersonatedBy: string | null | undefined, action: string, details: object) {
  const current = await prisma.sceneLayout.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" }, select: { version: true } });
  const version = (current?.version ?? 0) + 1;
  const row = await prisma.$transaction(async (tx) => {
    await tx.sceneLayout.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const created = await tx.sceneLayout.create({ data: { name: LAYOUT_NAME, isActive: true, version, config: { ...config, version } } });
    await logAction({ userId, impersonatedBy, action, module: "office3d", entityId: created.id, details: { version, ...details } }, tx);
    return created;
  });
  revalidatePath("/office-3d");
  return row;
}

/** Layout editor (IMPLEMENTATION.md §8 3D-5): save moved/rotated items as a new active SceneLayout version. */
export async function saveLayout(moves: LayoutMove[]): Promise<FormState> {
  const session = await requirePermission("office3d", "configureLayout");
  const parsed = movesSchema.safeParse(moves);
  if (!parsed.success) return { message: "ตำแหน่งไม่ถูกต้อง (ต้องอยู่ในห้อง)" };

  const { config } = await getActiveLayout();
  const byId = new Map(parsed.data.map((m) => [m.id, m]));
  if ([...byId.keys()].some((id) => !config.items.some((i) => i.id === id))) return { message: "ไม่พบบางรายการในผังปัจจุบัน กรุณารีเฟรชแล้วลองใหม่" };

  const items = config.items.map((it) => {
    const m = byId.get(it.id);
    return m ? { ...it, position: [round(m.x), it.position[1], round(m.z)] as [number, number, number], rotationY: round(m.rotationY) } : it;
  });
  const row = await activate({ ...config, items }, session.user.id, session.session.impersonatedBy, "LAYOUT_SAVE", { moved: byId.size });
  return { ok: true, message: `บันทึกผังสำนักงานแล้ว (เวอร์ชัน ${row.version})` };
}

/** Back to the layout shipped with the models (as a new version, so earlier ones stay in history). */
export async function resetLayout(): Promise<FormState> {
  const session = await requirePermission("office3d", "configureLayout");
  const row = await activate(await readDefaultLayout(), session.user.id, session.session.impersonatedBy, "LAYOUT_RESET", {});
  return { ok: true, message: `คืนค่าผังเริ่มต้นแล้ว (เวอร์ชัน ${row.version})` };
}
