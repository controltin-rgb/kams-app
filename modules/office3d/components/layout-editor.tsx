"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { RotateCcw, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { Vector3 } from "three";
import { office3dModelLabels } from "@/lib/labels";
import { resetLayout, saveLayout } from "../actions";
import type { LayoutItem } from "../models";

/** Grid the editor snaps to (IMPLEMENTATION.md §8 3D-5) */
export const SNAP = 0.25;
const ROOM = { x: 7, z: 5 };

type Move = { x: number; z: number; rotationY: number };
const snap = (v: number, limit: number) => Math.min(limit, Math.max(-limit, Math.round(v / SNAP) * SNAP));

/**
 * Layout editor for people with office3d.configureLayout: pick an item, drag it on the floor or nudge it with the
 * arrow keys (snapped to 25 cm), rotate by 90°, then save as a new SceneLayout version. Items are only moved, never
 * added or removed, so locations stay bound to the same items.
 */
export function useLayoutEditor(items: LayoutItem[], onSaved: () => void) {
  const [editing, setEditing] = useState(false);
  const [moves, setMoves] = useState<Record<string, Move>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, startSaving] = useTransition();
  /** Pointer-down point and the item's place then, so the item keeps its offset from the pointer while dragging */
  const grab = useRef<{ point: { x: number; z: number }; from: Move } | null>(null);

  const draft = useMemo(
    () => items.map((it) => (moves[it.id] ? { ...it, position: [moves[it.id].x, it.position[1], moves[it.id].z] as LayoutItem["position"], rotationY: moves[it.id].rotationY } : it)),
    [items, moves],
  );
  const current = useCallback((id: string): Move => {
    const it = draft.find((i) => i.id === id)!;
    return { x: it.position[0], z: it.position[2], rotationY: it.rotationY };
  }, [draft]);
  const place = useCallback((id: string, m: Move) => setMoves((all) => ({ ...all, [id]: m })), []);

  const pick = useCallback(
    (id: string, point: Vector3) => {
      setSelected(id);
      grab.current = { point: { x: point.x, z: point.z }, from: current(id) };
      setDragging(true);
    },
    [current],
  );
  const drag = useCallback(
    (point: Vector3) => {
      const g = grab.current;
      if (!g || !selected) return;
      const next = { ...g.from, x: snap(g.from.x + point.x - g.point.x, ROOM.x), z: snap(g.from.z + point.z - g.point.z, ROOM.z) };
      const now = current(selected);
      if (next.x !== now.x || next.z !== now.z) place(selected, next);
    },
    [selected, current, place],
  );
  const rotate = useCallback(
    (deg: number) => {
      if (!selected) return;
      const now = current(selected);
      place(selected, { ...now, rotationY: (((now.rotationY + deg) % 360) + 360) % 360 });
    },
    [selected, current, place],
  );

  // Drags end wherever the pointer is released
  useEffect(() => {
    if (!dragging) return;
    const up = () => {
      grab.current = null;
      setDragging(false);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [dragging]);

  // Arrow keys nudge by one grid step, R rotates (Shift+R the other way), Esc lets go of the item
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "Escape") return setSelected(null);
      if (!selected) return;
      const step: Record<string, [number, number]> = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] };
      if (step[e.key]) {
        e.preventDefault();
        const now = current(selected);
        // Only the axis pressed moves (onto the grid); the other keeps its place
        const [dx, dz] = step[e.key];
        place(selected, { ...now, x: dx ? snap(now.x + dx, ROOM.x) : now.x, z: dz ? snap(now.z + dz, ROOM.z) : now.z });
      } else if (e.key === "r" || e.key === "R") {
        rotate(e.shiftKey ? -90 : 90);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, selected, current, place, rotate]);

  const stop = useCallback(() => {
    setEditing(false);
    setMoves({});
    setSelected(null);
    setDragging(false);
  }, []);

  const save = () =>
    startSaving(async () => {
      const res = await saveLayout(Object.entries(moves).map(([id, m]) => ({ id, ...m })));
      if (!res.ok) return void toast.error(res.message ?? "บันทึกไม่สำเร็จ");
      toast.success(res.message);
      stop();
      onSaved();
    });
  const reset = () =>
    startSaving(async () => {
      const res = await resetLayout();
      if (!res.ok) return void toast.error(res.message ?? "คืนค่าไม่สำเร็จ");
      toast.success(res.message);
      stop();
      onSaved();
    });

  return {
    editing,
    start: () => setEditing(true),
    cancel: stop,
    draft,
    selected: selected ? (draft.find((i) => i.id === selected) ?? null) : null,
    changed: Object.keys(moves).length,
    dragging,
    pick,
    drag,
    rotate,
    save,
    reset,
    saving,
  };
}
export type LayoutEditor = ReturnType<typeof useLayoutEditor>;

/** Invisible floor the dragged item follows (only while dragging, so it never catches other clicks). */
export function DragPlane({ onMove }: { onMove: (point: Vector3) => void }) {
  return (
    <mesh visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerMove={(e: ThreeEvent<PointerEvent>) => onMove(e.point)}>
      <planeGeometry args={[60, 60]} />
    </mesh>
  );
}

export function EditorBar({ editor }: { editor: LayoutEditor }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const item = editor.selected;
  return (
    <div role="toolbar" aria-label="จัดผังสำนักงาน" className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-2xl bg-card/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
      <div className="min-w-0 flex-1">
        {item ? (
          <p className="truncate font-semibold" data-testid="layout-selected">
            {office3dModelLabels[item.model] ?? item.model} <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              x {item.position[0].toFixed(2)} · z {item.position[2].toFixed(2)} · {item.rotationY}°
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">คลิกของในฉากเพื่อเลือก แล้วลากหรือกดลูกศรเพื่อย้าย (ทีละ 25 ซม.) · R หมุน 90°</p>
        )}
      </div>
      <button type="button" onClick={() => editor.rotate(-90)} disabled={!item} aria-label="หมุนทวนเข็ม 90 องศา" className="rounded-full p-2 transition hover:bg-muted disabled:opacity-40">
        <RotateCcw className="size-4" />
      </button>
      <button type="button" onClick={() => editor.rotate(90)} disabled={!item} aria-label="หมุนตามเข็ม 90 องศา" className="rounded-full p-2 transition hover:bg-muted disabled:opacity-40">
        <RotateCw className="size-4" />
      </button>
      {confirmReset ? (
        <button type="button" onClick={editor.reset} disabled={editor.saving} className="rounded-full bg-destructive px-4 py-2 font-semibold text-white transition disabled:opacity-60">
          ยืนยันคืนค่าผังเริ่มต้น
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmReset(true)} disabled={editor.saving} className="rounded-full px-4 py-2 font-semibold transition hover:bg-muted">
          คืนค่าเริ่มต้น
        </button>
      )}
      <button type="button" onClick={editor.cancel} disabled={editor.saving} className="rounded-full px-4 py-2 font-semibold transition hover:bg-muted">
        ยกเลิก
      </button>
      <button
        type="button"
        onClick={editor.save}
        disabled={editor.saving || !editor.changed}
        className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground transition disabled:opacity-50"
      >
        บันทึกผัง{editor.changed ? ` (${editor.changed})` : ""}
      </button>
    </div>
  );
}
