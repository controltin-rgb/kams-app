import type { Box3 } from "three";

/** Something under the pointer / selected in the scene. `box` (world space) drives the outline and tooltip. */
export type Hit =
  | { kind: "asset"; itemId: string; assetId: string | null; model: string; box: Box3 }
  | { kind: "agent"; agentId: string; box: Box3 }
  | { kind: "marker"; markerId: string; box: Box3 };

export const sameHit = (a: Hit | null, b: Hit | null) =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  (a.kind === "asset" ? a.itemId === (b as typeof a).itemId : a.kind === "agent" ? a.agentId === (b as typeof a).agentId : a.markerId === (b as typeof a).markerId);
