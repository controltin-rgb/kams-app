import { Euler, MathUtils, type Object3D, Quaternion, Vector3 } from "three";
import type { LayoutItem } from "../models";
import type { SceneAgent } from "../scene";
import { anchorWorld } from "../three/anchors";

export type Placement = { position: Vector3; quaternion: Quaternion; sitting: boolean };

/**
 * World transform of an agent. Sitting: at the chair nearest to the item's anchor (floor level, facing like the chair —
 * the sit clips lift the hips onto the seat). Standing: at the anchor itself.
 */
export function placeAgent(agent: SceneAgent, items: LayoutItem[], scenes: Record<string, Object3D>): Placement | null {
  const item = items.find((i) => i.id === agent.place.item);
  const root = item && scenes[item.model];
  if (!item || !root) return null;
  const anchor = anchorWorld(item, root, agent.place.anchor);
  if (agent.place.sit) {
    const chair = items
      .filter((i) => i.model === "chair_office")
      .map((c) => ({ c, d: Math.hypot(c.position[0] - anchor.position.x, c.position[2] - anchor.position.z) }))
      .filter((x) => x.d < 1.2)
      .sort((a, b) => a.d - b.d)[0]?.c;
    if (chair) {
      return {
        position: new Vector3(chair.position[0], 0, chair.position[2]),
        quaternion: new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(chair.rotationY), 0)),
        sitting: true,
      };
    }
  }
  return { position: anchor.position.setY(0), quaternion: anchor.quaternion, sitting: agent.place.sit };
}
