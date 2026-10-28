"use client";

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, PerformanceMonitor, useGLTF, useProgress } from "@react-three/drei";
import { LayoutGrid, RefreshCw, VideoOff } from "lucide-react";
import { type Box3, Box3Helper, Color, type Mesh, type Object3D } from "three";
import { type Home, OfficeRuntime } from "../agents/runner";
import type { SceneEventMessage } from "../events";
import { modelKeyUrl, modelUrl } from "../models";
import { applySceneEvent, assetStatusColors, type MarkerKind, type OfficeSnapshot, type SceneAgent, type SceneMarker } from "../scene";
import { patch, resetOfficeStore, useOfficeStore } from "../store";
import { anchorWorld, itemBox } from "../three/anchors";
import { buildNavGrid, resolveTarget } from "../three/targets";
import { ActivityFeed, PlaybackControls } from "./activity-feed";
import { CameraRig, FollowCamera } from "./camera";
import { AgentShadows, Character, FollowAgent, HeldProp } from "./character";
import { DetailPanel, describeHit } from "./detail-panel";
import { DevStats } from "./dev-stats";
import { type Hit, sameHit } from "./hit";
import { DragPlane, EditorBar, type LayoutEditor, useLayoutEditor } from "./layout-editor";
import { LayoutItems } from "./layout-items";
import { Legend } from "./legend";
import { Marker } from "./markers";
import { placeAgent } from "./placement";
import { RuntimeContext } from "./runtime-context";
import { AuditBadge, StatusRings } from "./stock-take";
import { useSceneStream } from "./use-scene-stream";
import { KioskButton, KioskExit, QualityButton, useKiosk, useQuality } from "./view-options";
import { ZoneSigns } from "./zone-signs";

const HOVER_COLOR = new Color("#f59e0b");
const SELECT_COLOR = new Color("#7c5ce6");
/** Loaded up front so scenes never suspend the canvas: markers, held props and the looks of visitors */
const SCENE_MODELS = ["marker_alert", "marker_wrench", "marker_pause", "marker_check", "zone_sign", "ticket_paper", "parts_box", "box_small", "box_large", "package_courier", "clipboard", "smartphone", "status_ring"];
/** Looks of visitors (people walking in from the entrance). Characters load by single URL, a different cache entry from
 * the list above, so these are preloaded that way: a visitor's model is ready before they appear. */
const VISITOR_MODELS = ["char_staff_a", "char_staff_b", "char_staff_c", "char_courier"];
for (const m of VISITOR_MODELS) useGLTF.preload(modelKeyUrl(m));

/** Runtime → UI: discrete changes go to the store (never per frame); ticket/asset changes to the snapshot. */
const runtimeHooks = (commit: (e: SceneEventMessage) => void) => ({
  commit,
  visitors: (visitors: SceneAgent[]) => useOfficeStore.setState({ visitors }),
  bubble: (id: string, text: string | null) => useOfficeStore.setState((s) => ({ bubbles: patch(s.bubbles, id, text) })),
  hold: (id: string, prop: string | null) => useOfficeStore.setState((s) => ({ held: patch(s.held, id, prop) })),
  flash: (id: string, marker: MarkerKind | null) => useOfficeStore.setState((s) => ({ flashes: patch(s.flashes, id, marker) })),
  queue: (waiting: number, running: number) => useOfficeStore.setState({ waiting, running }),
  ring: (item: string, color: string | null) => useOfficeStore.setState((s) => ({ rings: patch(s.rings, item, color) })),
  hide: (items: string[], hidden: boolean) =>
    useOfficeStore.setState((s) => {
      const next = new Set(s.hiddenItems);
      for (const id of items) {
        if (hidden) next.add(id);
        else next.delete(id);
      }
      return { hiddenItems: next };
    }),
});

function Outline({ box, color }: { box: Box3; color: Color }) {
  const helper = useMemo(() => new Box3Helper(box.clone().expandByScalar(0.03), color), [box, color]);
  useEffect(() => () => helper.dispose(), [helper]);
  return <primitive object={helper} />;
}

/** Plays the scenes; a separate component so the frame callback never re-renders the office. */
function Director({ runtime }: { runtime: OfficeRuntime }) {
  useFrame((_, dt) => runtime.update(Math.min(dt, 0.1)));
  return null;
}

function SpeechBubbles() {
  const bubbles = useOfficeStore((s) => s.bubbles);
  return Object.entries(bubbles).map(([id, text]) => (
    <FollowAgent key={id} agentId={id}>
      <Html position={[0, 2.05, 0]} center zIndexRange={[25, 0]} className="pointer-events-none">
        <span className="block max-w-56 -translate-y-1/2 truncate rounded-2xl bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-md">{text}</span>
      </Html>
    </FollowAgent>
  ));
}

/** The office built from office_shell + layout items, with people and markers from the snapshot and live scenes. */
function Office({
  snap,
  hover,
  selected,
  onHover,
  onSelect,
  onCommit,
  editor,
  follow,
  onFollowLost,
}: {
  snap: OfficeSnapshot;
  hover: Hit | null;
  selected: Hit | null;
  onHover: (h: Hit | null) => void;
  onSelect: (h: Hit) => void;
  onCommit: (e: SceneEventMessage) => void;
  /** Layout editing: furniture only, draggable; people step out until it ends */
  editor: LayoutEditor | null;
  follow: string | null;
  onFollowLost: () => void;
}) {
  const { layout } = snap;
  const keys = useMemo(() => [...new Set([...layout.items.map((i) => i.model), ...SCENE_MODELS])], [layout.items]);
  const gltfs = useGLTF([modelUrl(layout.shell), ...keys.map(modelKeyUrl)]);
  const shell = gltfs[0].scene;
  const scenes = useMemo(() => Object.fromEntries(keys.map((k, i) => [k, gltfs[i + 1].scene])) as Record<string, Object3D>, [keys, gltfs]);

  useEffect(() => {
    shell.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      o.receiveShadow = true;
      o.castShadow = true;
    });
  }, [shell]);

  const assetOfItem = useMemo(() => new Map(snap.assets.map((a) => [a.itemId, a.id])), [snap.assets]);
  const statusColors = useMemo(() => new Map(snap.assets.map((a) => [a.itemId, assetStatusColors[a.status]])), [snap.assets]);
  const homes = useMemo(() => {
    const out = new Map<string, Home>();
    for (const a of snap.agents) {
      const p = placeAgent(a, layout.items, scenes);
      if (p) out.set(a.id, p);
    }
    return out;
  }, [snap.agents, layout.items, scenes]);
  const grid = useMemo(() => buildNavGrid(shell, layout.items, scenes), [shell, layout.items, scenes]);
  // Which item shows which asset only changes with a new snapshot (live events change statuses, not places)
  const assetKey = snap.assets.map((a) => `${a.id}:${a.itemId}`).join(",");
  const assetItems = useMemo(() => Object.fromEntries(assetKey ? assetKey.split(",").map((p) => p.split(":")) : []) as Record<string, string>, [assetKey]);
  const runtime = useMemo(
    () => new OfficeRuntime({ agents: snap.agents, items: layout.items, assetItems: {} }, homes, grid, (t) => resolveTarget(t, layout.items, scenes, layout.zones), runtimeHooks(onCommit)),
    [snap.agents, layout.items, layout.zones, homes, grid, scenes, onCommit],
  );
  // Assets reload after swaps; the runtime keeps playing with the new places (declared before attach: set first)
  useEffect(() => runtime.setAssetItems(assetItems), [runtime, assetItems]);
  useEffect(() => {
    const { attach, detach } = useOfficeStore.getState();
    attach(runtime);
    // A hidden tab gets no frames: jump to the end state instead of replaying a backlog later
    const onVisibility = () => document.hidden && runtime.catchUp();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      detach(runtime);
    };
  }, [runtime]);

  const visitors = useOfficeStore((s) => s.visitors);
  const held = useOfficeStore((s) => s.held);
  const hiddenItems = useOfficeStore((s) => s.hiddenItems);
  const rings = useOfficeStore((s) => s.rings);
  const flashes = useOfficeStore((s) => s.flashes);
  const flashMarkers = useMemo(() => {
    const above = new Map<string, number>();
    for (const m of snap.markers) above.set(m.agentId, Math.max(above.get(m.agentId) ?? 0, m.level + 1));
    return Object.entries(flashes).map(
      ([agentId, kind]): SceneMarker => ({ id: `flash-${agentId}`, kind, agentId, level: above.get(agentId) ?? 0, color: null, blink: false, reason: "working", ticketIds: [] }),
    );
  }, [flashes, snap.markers]);

  const helpdesk = layout.items.find((i) => i.model === "desk_helpdesk");
  const badge = helpdesk ? anchorWorld(helpdesk, scenes.desk_helpdesk, "anchor_badge").position : null;
  const tip = hover ? describeHit(hover, { ...snap, agents: [...snap.agents, ...visitors] }) : null;

  if (editor) {
    const picked = editor.selected;
    return (
      <RuntimeContext value={runtime}>
        <Director runtime={runtime} />
        <primitive object={shell} />
        <LayoutItems items={editor.draft} scenes={scenes} statusColors={statusColors} assetOfItem={assetOfItem} hidden={hiddenItems} onHover={onHover} onSelect={onSelect} onPick={editor.pick} />
        <ZoneSigns zones={layout.zones} model={scenes.zone_sign} />
        {picked && scenes[picked.model] && <Outline box={itemBox(picked, scenes[picked.model])} color={SELECT_COLOR} />}
        {editor.dragging && <DragPlane onMove={editor.drag} />}
      </RuntimeContext>
    );
  }

  return (
    <RuntimeContext value={runtime}>
      <Director runtime={runtime} />
      <FollowCamera agentId={follow} onLost={onFollowLost} />
      <primitive object={shell} />
      <LayoutItems items={layout.items} scenes={scenes} statusColors={statusColors} assetOfItem={assetOfItem} hidden={hiddenItems} onHover={onHover} onSelect={onSelect} />
      {/* Own boundary per person: a model still loading delays only that person, never hides the office */}
      {[...snap.agents.filter((a) => homes.has(a.id)), ...visitors].map((a) => (
        <Suspense key={a.id} fallback={null}>
          <Character agent={a} onHover={onHover} onSelect={onSelect} />
        </Suspense>
      ))}
      {snap.markers.map((m) => (
        <Marker key={m.id} marker={m} model={scenes[`marker_${m.kind}`]} onHover={onHover} onSelect={onSelect} />
      ))}
      {flashMarkers.map((m) => (
        <Marker key={m.id} marker={m} model={scenes[`marker_${m.kind}`]} />
      ))}
      {Object.entries(held).map(([id, prop]) => scenes[prop] && <HeldProp key={id} agentId={id} prop={prop} model={scenes[prop]} />)}
      <SpeechBubbles />
      <StatusRings rings={rings} items={layout.items} model={scenes.status_ring} />
      {snap.audit && layout.zones.zone_storage && <AuditBadge audit={snap.audit} zone={layout.zones.zone_storage} />}
      <AgentShadows />
      <ZoneSigns zones={layout.zones} model={scenes.zone_sign} />
      {badge && snap.openCount > 0 && (
        <Html position={badge} center zIndexRange={[20, 0]} className="pointer-events-none">
          <span className="whitespace-nowrap rounded-full bg-[#D2493F] px-3 py-1 text-xs font-semibold text-white shadow">งานค้าง {snap.openCount}</span>
        </Html>
      )}
      {hover && !sameHit(hover, selected) && <Outline box={hover.box} color={HOVER_COLOR} />}
      {selected && <Outline box={selected.box} color={SELECT_COLOR} />}
      {hover && tip?.title && (
        <Html position={[(hover.box.min.x + hover.box.max.x) / 2, hover.box.max.y + 0.1, (hover.box.min.z + hover.box.max.z) / 2]} center zIndexRange={[30, 0]} className="pointer-events-none">
          <div className="-translate-y-1/2 whitespace-nowrap rounded-lg bg-black/75 px-2.5 py-1.5 text-xs text-white">
            <p className="font-semibold">{tip.title}</p>
            {tip.sub && <p className="opacity-80">{tip.sub}</p>}
          </div>
        </Html>
      )}
    </RuntimeContext>
  );
}

/** DOM overlay outside the Canvas (drei <Html> as a Suspense fallback breaks on unmount). */
function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="rounded-full bg-card px-4 py-2 text-sm font-medium shadow-sm">กำลังโหลดฉาก… {Math.round(progress)}%</span>
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="font-semibold">ไม่สามารถแสดงผล 3D Office ได้</p>
          <p className="text-sm text-muted-foreground">เบราว์เซอร์หรืออุปกรณ์นี้อาจไม่รองรับ WebGL หรือโหลดโมเดลไม่สำเร็จ</p>
          <Link href="/dashboard" className="inline-block rounded-full bg-muted px-4 py-2 text-sm font-semibold">
            กลับ Dashboard
          </Link>
        </div>
      </div>
    );
  }
}

const newer = (a: string | null, b: string | null) => (a !== null && (b === null || BigInt(a) > BigInt(b)) ? a : b);

export default function OfficeCanvas({ initial, canEditLayout }: { initial: OfficeSnapshot; canEditLayout: boolean }) {
  const [snap, setSnap] = useState(initial);
  const [hover, setHover] = useState<Hit | null>(null);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [follow, setFollow] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState(false);
  const visitors = useOfficeStore((s) => s.visitors);
  const root = useRef<HTMLDivElement>(null);
  const stats = useRef<HTMLDivElement>(null);
  /** Newest event already reflected in `snap` (from the snapshot or played); older stream events are ignored */
  const seen = useRef(initial.lastEventId);
  // FPS / draw calls: always in dev, or with ?stats in the URL (performance checks on real machines)
  const [showStats] = useState(() => process.env.NODE_ENV === "development" || new URLSearchParams(window.location.search).has("stats"));
  const writeStats = (text: string) => {
    if (stats.current) stats.current.textContent = text;
  };
  const { quality, setQuality, low, setStruggling } = useQuality();
  const { kiosk, enter: enterKiosk, exit: exitKiosk } = useKiosk(root);

  // Esc stops following (kiosk handles its own Esc)
  useEffect(() => {
    if (!follow) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFollow(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [follow]);

  // The store outlives the page (client-side navigation): leave it clean for the next visit
  useEffect(() => resetOfficeStore, []);

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => void (document.body.style.cursor = "");
  }, [hover]);

  const commit = useCallback((e: SceneEventMessage) => {
    setSnap((s) => applySceneEvent(s, e, Date.now()));
    // A swap puts another asset in the same place: reload which asset each item shows (filtered for this viewer)
    if (e.type === "SWAP_PARTIAL" || e.type === "SWAP_FULL") {
      void fetch("/api/office/snapshot", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<OfficeSnapshot>) : null))
        .then((next) => next && setSnap((s) => ({ ...s, assets: next.assets })))
        .catch(() => {});
    }
  }, []);

  const refresh = () =>
    startRefresh(async () => {
      const res = await fetch("/api/office/snapshot", { cache: "no-store" });
      if (!res.ok) return setError(true);
      setError(false);
      const next = (await res.json()) as OfficeSnapshot;
      seen.current = newer(next.lastEventId, seen.current);
      setSnap(next);
      setSelected(null);
    });

  useSceneStream(
    initial.lastEventId,
    (e) => {
      if (seen.current !== null && BigInt(e.id) <= BigInt(seen.current)) return;
      seen.current = e.id;
      useOfficeStore.getState().deliver(e);
    },
    refresh,
  );

  const editor = useLayoutEditor(snap.layout.items, refresh);
  const startEditing = () => {
    setSelected(null);
    setHover(null);
    setFollow(null);
    editor.start();
  };
  const view = visitors.length ? { ...snap, agents: [...snap.agents, ...visitors] } : snap;
  const controls = !kiosk && !editor.editing;

  return (
    <SceneErrorBoundary>
      <div ref={root} className={kiosk ? "fixed inset-0 z-100 bg-[#f6f1ec] dark:bg-[#2a2622]" : "absolute inset-0"} data-testid="office-root" data-kiosk={kiosk || undefined}>
        <Canvas shadows flat dpr={low ? 1 : [1, 2]} aria-label="ฉากสำนักงาน 3 มิติ" onPointerMissed={() => setSelected(null)}>
          <PerformanceMonitor onDecline={() => setStruggling(true)} onIncline={() => setStruggling(false)} />
          <hemisphereLight args={["#fffaf2", "#d9b48a", 2]} />
          <directionalLight
            position={[-6, 12, 8]}
            intensity={1.6}
            castShadow={!low}
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0005}
            shadow-camera-left={-11}
            shadow-camera-right={11}
            shadow-camera-top={11}
            shadow-camera-bottom={-11}
          />
          <Suspense fallback={null}>
            <Office
              snap={snap}
              hover={hover}
              selected={selected}
              onHover={setHover}
              onSelect={setSelected}
              onCommit={commit}
              editor={editor.editing ? editor : null}
              follow={follow}
              onFollowLost={() => setFollow(null)}
            />
          </Suspense>
          <CameraRig locked={editor.editing} />
          {showStats && <DevStats onSample={writeStats} />}
        </Canvas>
        <Loader />
        {showStats && <div ref={stats} data-testid="office-stats" className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white" />}
        {!editor.editing && <ActivityFeed />}
        {kiosk && <KioskExit onClick={exitKiosk} />}
        {controls && (
          <div className="absolute right-3 top-3 flex flex-wrap items-center justify-end gap-2">
            {error && <span className="rounded-full bg-card px-3 py-1.5 text-xs text-red-600 shadow-sm">โหลดข้อมูลไม่สำเร็จ</span>}
            {follow && (
              <button type="button" onClick={() => setFollow(null)} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
                <VideoOff className="size-4" /> เลิกติดตาม
              </button>
            )}
            <PlaybackControls />
            <QualityButton quality={quality} onChange={setQuality} />
            {canEditLayout && (
              <button type="button" onClick={startEditing} className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-muted">
                <LayoutGrid className="size-4" /> จัดผัง
              </button>
            )}
            <KioskButton onClick={enterKiosk} />
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="group flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-4 transition-transform duration-500 group-hover:rotate-180 ${refreshing ? "animate-spin" : ""}`} /> รีเฟรช
            </button>
          </div>
        )}
        {controls && <Legend />}
        {editor.editing && <EditorBar editor={editor} />}
        {controls && selected && (
          <DetailPanel
            hit={selected}
            snap={view}
            onClose={() => setSelected(null)}
            following={selected.kind === "agent" && follow === selected.agentId}
            onFollow={(agentId) => setFollow((f) => (f === agentId ? null : agentId))}
          />
        )}
      </div>
    </SceneErrorBoundary>
  );
}
