"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group, Object3D } from "three";
import { auditResultLabels } from "@/lib/labels";
import type { LayoutItem, ScenePlacement } from "../models";
import { auditResultColors, scannedCount, type SceneAudit } from "../scene";
import { setMaterialColor } from "../three/materials";

/** Items on furniture keep their ring at their own height; everything else on the floor */
const FLOOR = 0.01;

/** A status_ring (mat_status_light, cloned per ring) blinking around one layout item for a scan result. */
function StatusRing({ item, color, model }: { item: LayoutItem; color: string; model: Object3D }) {
  const { object, clones } = useMemo(() => {
    const obj = model.clone(true);
    return { object: obj, clones: setMaterialColor(obj, "mat_status_light", color, true) };
  }, [model, color]);
  useEffect(() => () => clones.forEach((m) => m.dispose()), [clones]);
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.visible = Math.sin(clock.elapsedTime * Math.PI * 4) > -0.5;
  });
  const [x, y, z] = item.position;
  return (
    <group ref={ref} position={[x, y > 0.3 ? y + 0.005 : FLOOR, z]}>
      <primitive object={object} />
    </group>
  );
}

export function StatusRings({ rings, items, model }: { rings: Record<string, string>; items: LayoutItem[]; model: Object3D }) {
  return Object.entries(rings).map(([itemId, color]) => {
    const item = items.find((i) => i.id === itemId);
    return item ? <StatusRing key={itemId} item={item} color={color} model={model} /> : null;
  });
}

const results = ["MATCHED", "RELOCATED", "UNREGISTERED", "MISSING"] as const;

/** Progress of the stock take being counted, above the storage zone (IMPLEMENTATION.md §8 3D-4). */
export function AuditBadge({ audit, zone }: { audit: SceneAudit; zone: ScenePlacement }) {
  const scanned = scannedCount(audit.tally);
  return (
    <Html position={[zone.position[0], 2.6, zone.position[2]]} center zIndexRange={[20, 0]} className="pointer-events-none">
      <div className="min-w-44 rounded-xl bg-card/95 px-3 py-2 text-xs shadow-md" data-testid="office-audit">
        <p className="truncate font-semibold">ตรวจนับ{audit.title ? ` · ${audit.title}` : ""}</p>
        <p className="text-muted-foreground">
          สแกนแล้ว {scanned}
          {audit.expected !== null ? ` / ${audit.expected}` : ""}
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
          {results.map((r) => (
            <li key={r} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: auditResultColors[r] }} />
              {auditResultLabels[r]} {audit.tally[r]}
            </li>
          ))}
        </ul>
      </div>
    </Html>
  );
}
