"use client";

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Color, InstancedMesh, type Material, Matrix4, type Mesh, type Object3D, type Vector3 } from "three";
import { isAssetModel, type LayoutItem } from "../models";
import { DEFAULT_STATUS_COLOR } from "../scene";
import { itemBox, itemMatrix } from "../three/anchors";
import { showInstances } from "../three/frame";
import { statusLightMaterial } from "../three/materials";
import type { Hit } from "./hit";

type Built = { mesh: InstancedMesh; model: string; items: LayoutItem[]; matrices: Matrix4[] };

/**
 * All layout items as one InstancedMesh per model mesh (keeps draw calls low: ~1 per distinct mesh, not per item).
 * Status lights of assets get a per-instance colour.
 */
function buildInstances(items: LayoutItem[], scenes: Record<string, Object3D>, colorOf: (itemId: string) => string) {
  const byModel = new Map<string, LayoutItem[]>();
  for (const it of items) byModel.set(it.model, [...(byModel.get(it.model) ?? []), it]);

  const built: Built[] = [];
  const materials: Material[] = [];
  const color = new Color();
  for (const [model, list] of byModel) {
    const root = scenes[model];
    if (!root) continue;
    root.updateMatrixWorld(true);
    const rootInv = new Matrix4().copy(root.matrixWorld).invert();
    const asset = isAssetModel(model);
    root.traverse((o) => {
      const src = o as Mesh;
      if (!src.isMesh) return;
      const local = rootInv.clone().multiply(src.matrixWorld);
      const isStatus = !Array.isArray(src.material) && src.material.name === "mat_status_light";
      const material = isStatus ? statusLightMaterial(src.material as Material) : src.material;
      if (isStatus) materials.push(material as Material);
      const mesh = new InstancedMesh(src.geometry, material, list.length);
      const matrices = list.map((it) => itemMatrix(it).multiply(local));
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, matrices[i]);
        if (isStatus) mesh.setColorAt(i, color.set(colorOf(it.id)));
      });
      // Bounds over all instances, otherwise culling/raycasting use the model at the origin
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
      mesh.castShadow = !asset; // small assets add draw calls to the shadow pass for little visual gain
      mesh.receiveShadow = true;
      built.push({ mesh, model, items: list, matrices });
    });
  }
  return { built, materials };
}

export function LayoutItems({
  items,
  scenes,
  statusColors,
  assetOfItem,
  hidden,
  onHover,
  onSelect,
  onPick,
}: {
  items: LayoutItem[];
  scenes: Record<string, Object3D>;
  /** itemId → status colour (bound assets only) */
  statusColors: Map<string, string>;
  /** itemId → assetId */
  assetOfItem: Map<string, string>;
  /** Items taken off their place for a moment (being swapped) */
  hidden: ReadonlySet<string>;
  onHover: (hit: Hit | null) => void;
  onSelect: (hit: Hit) => void;
  /** Layout editing: every item (not just assets) can be grabbed; hover/selection are off */
  onPick?: (itemId: string, point: Vector3) => void;
}) {
  const { built, materials } = useMemo(() => buildInstances(items, scenes, (id) => statusColors.get(id) ?? DEFAULT_STATUS_COLOR), [items, scenes, statusColors]);
  useEffect(
    () => () => {
      built.forEach((b) => b.mesh.dispose());
      materials.forEach((m) => m.dispose());
    },
    [built, materials],
  );

  useEffect(() => {
    for (const b of built) showInstances(b.mesh, b.matrices, b.items.map((it) => !hidden.has(it.id)));
  }, [built, hidden]);

  const hitOf = (b: Built, e: ThreeEvent<PointerEvent | MouseEvent>): Hit | null => {
    const item = e.instanceId != null ? b.items[e.instanceId] : undefined;
    if (!item) return null;
    return { kind: "asset", itemId: item.id, assetId: assetOfItem.get(item.id) ?? null, model: item.model, box: itemBox(item, scenes[b.model]) };
  };

  if (onPick) {
    return built.map((b) => (
      <primitive
        key={b.mesh.uuid}
        object={b.mesh}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          const item = e.instanceId != null ? b.items[e.instanceId] : undefined;
          if (!item) return;
          e.stopPropagation();
          onPick(item.id, e.point);
        }}
      />
    ));
  }

  return built.map((b) =>
    isAssetModel(b.model) ? (
      <primitive
        key={b.mesh.uuid}
        object={b.mesh}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(hitOf(b, e));
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const hit = hitOf(b, e);
          if (hit) onSelect(hit);
        }}
      />
    ) : (
      <primitive key={b.mesh.uuid} object={b.mesh} />
    ),
  );
}
