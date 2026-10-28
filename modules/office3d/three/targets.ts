import { Euler, MathUtils, Mesh, type Object3D, Quaternion, Vector3 } from "three";
import type { Target } from "../director";
import type { LayoutItem, ScenePlacement } from "../models";
import { isAssetModel, isCharacterModel } from "../models";
import { NavGrid, type Rect } from "../nav/grid";
import { anchorWorld, itemBox } from "./anchors";

export type Resolved = {
  position: Vector3;
  /** Direction to face on arrival (anchor +Z); null = face `lookAt` */
  quaternion: Quaternion | null;
  lookAt: Vector3 | null;
};

/** World position/facing of a scene target. Items without the anchor fall back to the item itself (face it). */
export function resolveTarget(target: Target, items: LayoutItem[], scenes: Record<string, Object3D>, zones: Record<string, ScenePlacement>): Resolved | null {
  if (target.kind === "zone") {
    const z = zones[target.zone];
    if (!z) return null;
    const quaternion = new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(z.rotationY), 0));
    const position = new Vector3(...z.position).setY(0);
    if (target.offset) position.add(new Vector3(target.offset[0], 0, target.offset[1]).applyQuaternion(quaternion));
    return { position, quaternion, lookAt: null };
  }
  const item = items.find((i) => i.id === target.item);
  const root = item && scenes[item.model];
  if (!item || !root) return null;
  if (!root.getObjectByName(target.anchor)) {
    // In front of the item (+Z), facing it
    const q = new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(item.rotationY), 0));
    const center = new Vector3(...item.position).setY(0);
    return { position: center.clone().add(new Vector3(0, 0, 0.7).applyQuaternion(q)), quaternion: null, lookAt: center };
  }
  const { position, quaternion } = anchorWorld(item, root, target.anchor);
  if (target.offset) position.add(new Vector3(target.offset[0], 0, target.offset[1]).applyQuaternion(quaternion));
  return { position: position.setY(0), quaternion, lookAt: null };
}

export const ROOM = { minX: -7, minZ: -5, maxX: 7, maxZ: 5 };
/** Clearance around furniture so bodies (not just centre points) stay out of it */
const CLEARANCE = 0.15;
/** Walls/partitions count where they cross this height band; floor-standing items start below FLOOR_ITEM */
const BODY_MIN = 0.3;
const BODY_MAX = 1.6;
const FLOOR_ITEM = 0.3;

/**
 * Walkable floor (IMPLEMENTATION.md §6.6): shell triangles crossing body height (walls, glass partitions) and the
 * footprint of every floor-standing layout item. Items on desks / walls (bottom above FLOOR_ITEM) do not block.
 */
export function buildNavGrid(shell: Object3D, items: LayoutItem[], scenes: Record<string, Object3D>) {
  const grid = new NavGrid(ROOM, 0.25);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  shell.updateMatrixWorld(true);
  shell.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const pos = o.geometry.getAttribute("position");
    const index = o.geometry.getIndex();
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
      a.fromBufferAttribute(pos, ia).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, ib).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, ic).applyMatrix4(o.matrixWorld);
      if (Math.max(a.y, b.y, c.y) < BODY_MIN || Math.min(a.y, b.y, c.y) > BODY_MAX) continue;
      const rect: Rect = [Math.min(a.x, b.x, c.x) - 0.1, Math.min(a.z, b.z, c.z) - 0.1, Math.max(a.x, b.x, c.x) + 0.1, Math.max(a.z, b.z, c.z) + 0.1];
      grid.block(rect);
    }
  });
  for (const item of items) {
    const root = scenes[item.model];
    if (!root || isCharacterModel(item.model) || item.model.startsWith("marker_")) continue;
    const box = itemBox(item, root);
    if (box.min.y > FLOOR_ITEM || (isAssetModel(item.model) && box.max.y - box.min.y < 0.2)) continue;
    grid.block([box.min.x - CLEARANCE, box.min.z - CLEARANCE, box.max.x + CLEARANCE, box.max.z + CLEARANCE]);
  }
  return grid;
}
