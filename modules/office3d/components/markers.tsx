"use client";

import { useEffect, useMemo, useRef } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { Box3, type Group, type Object3D, Vector3 } from "three";
import type { SceneMarker } from "../scene";
import { setMaterialColor } from "../three/materials";
import type { Hit } from "./hit";
import { useRuntime } from "./runtime-context";

/** Gap between stacked markers above one person */
const LEVEL_GAP = 0.35;

/**
 * Floating marker above a person, following them as they walk; CRITICAL/overdue markers blink.
 * Alert colours come from mat_accent (cloned per marker); wrench/pause/check keep their own colour.
 */
export function Marker({
  marker,
  model,
  onHover,
  onSelect,
}: {
  marker: SceneMarker;
  model: Object3D;
  onHover?: (hit: Hit | null) => void;
  onSelect?: (hit: Hit) => void;
}) {
  const runtime = useRuntime();
  const { object, clones } = useMemo(() => {
    const obj = model.clone(true);
    return { object: obj, clones: marker.color ? setMaterialColor(obj, "mat_accent", marker.color, true) : [] };
  }, [model, marker.color]);
  useEffect(() => () => clones.forEach((m) => m.dispose()), [clones]);

  const ref = useRef<Group>(null);
  const seed = useMemo(() => marker.id.length * 0.7, [marker.id]);
  // Above the head: lower while sitting
  const baseY = (sitting: boolean) => (sitting ? 1.45 : 1.8) + marker.level * LEVEL_GAP;
  useFrame(({ clock }) => {
    const g = ref.current;
    const a = runtime.agent(marker.agentId);
    if (!g || !a) return;
    const t = clock.elapsedTime + seed;
    g.position.set(a.pos.x, baseY(a.sitting) + Math.sin(t * 2.2) * 0.05, a.pos.z);
    g.rotation.y = t * 0.8;
    g.visible = !marker.blink || Math.sin(t * Math.PI * 3) > -0.4;
  });

  const hit = (): Hit | null => {
    const a = runtime.agent(marker.agentId);
    if (!a) return null;
    return { kind: "marker", markerId: marker.id, box: new Box3().setFromCenterAndSize(new Vector3(a.pos.x, baseY(a.sitting) + 0.15, a.pos.z), new Vector3(0.35, 0.35, 0.35)) };
  };

  return (
    <group
      ref={ref}
      onPointerOver={
        onHover &&
        ((e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(hit());
        })
      }
      onPointerOut={onHover && (() => onHover(null))}
      onClick={
        onSelect &&
        ((e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const h = hit();
          if (h) onSelect(h);
        })
      }
    >
      <primitive object={object} />
    </group>
  );
}
