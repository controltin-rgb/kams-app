import { type AnimationAction, type AnimationMixer, LoopOnce, LoopRepeat, type Object3D, type SkinnedMesh } from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

/** Clips that play once and hold the last frame (IMPLEMENTATION.md §2.4); everything else loops. */
export const ONCE_CLIPS = new Set(["sit_down", "stand_up", "point", "wave", "handover", "pickup", "putdown", "celebrate"]);
const FADE = 0.2;

/**
 * Own copy of a character file (useGLTF caches by URL; SkeletonUtils keeps the skeleton working).
 * Never frustum-culled: three.js caches a skinned mesh's bounds the first time it is culled, and for someone who
 * walks in while that happens in their first frame the stale bounds can hide them for the whole walk.
 */
export function cloneCharacter(scene: Object3D) {
  const body = skeletonClone(scene);
  body.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) o.frustumCulled = false;
  });
  return body;
}

/** How the runtime drives one character: it moves `root` itself and asks for clips here. */
export type CharacterController = {
  root: Object3D;
  /** Cross-fade to a clip; returns its length in seconds. `offset` (0..1) starts a loop part-way so people are not in sync. */
  play(clip: string, offset?: number): number;
  /** Animation speed (0 = paused) */
  setTimeScale(scale: number): void;
  socket(side: "l" | "r"): Object3D | null;
};

export function createController(root: Object3D, body: Object3D, actions: Record<string, AnimationAction | null>, mixer: AnimationMixer): CharacterController {
  let current: AnimationAction | null = null;
  return {
    root,
    play(clip, offset = 0) {
      const next = actions[clip] ?? actions.idle ?? null;
      if (!next) return 1;
      const once = ONCE_CLIPS.has(clip);
      const duration = next.getClip().duration;
      if (next === current && !once) return duration;
      next.reset();
      next.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      if (offset) next.startAt(mixer.time - offset * duration);
      next.fadeIn(FADE).play();
      if (current && current !== next) current.fadeOut(FADE);
      current = next;
      return duration;
    },
    setTimeScale(scale) {
      mixer.timeScale = scale;
    },
    socket: (side) => body.getObjectByName(`socket_hand_${side}`) ?? null,
  };
}
