"use client";

import { create } from "zustand";
import type { OfficeRuntime } from "./agents/runner";
import type { SceneEventMessage } from "./events";
import type { MarkerKind, SceneAgent } from "./scene";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
export type StreamStatus = "connecting" | "live" | "offline";

const FEED_MAX = 30;

/**
 * UI state of the 3D Office that changes at discrete moments (never per frame): activity feed, controls,
 * speech bubbles / held props / flash markers of the running scenes, and the runtime that plays events.
 */
type OfficeState = {
  runtime: OfficeRuntime | null;
  /** Events that arrived while the scene was still loading */
  inbox: SceneEventMessage[];
  feed: SceneEventMessage[];
  speed: Speed;
  paused: boolean;
  waiting: number;
  /** Scenes playing right now */
  running: number;
  stream: StreamStatus;
  visitors: SceneAgent[];
  bubbles: Record<string, string>;
  held: Record<string, string>;
  flashes: Record<string, MarkerKind>;
  /** Layout items taken off their place by a running scene */
  hiddenItems: ReadonlySet<string>;
  /** status_ring colours around layout items (stock-take results) */
  rings: Record<string, string>;

  deliver(event: SceneEventMessage): void;
  attach(runtime: OfficeRuntime): void;
  detach(runtime: OfficeRuntime): void;
  setSpeed(speed: Speed): void;
  togglePaused(): void;
  setStream(stream: StreamStatus): void;
};

const hidden = () => typeof document !== "undefined" && document.hidden;
const without = <T>(map: Record<string, T>, key: string) => {
  const next = { ...map };
  delete next[key];
  return next;
};
/** Set or remove one entry (null removes) */
export const patch = <T>(map: Record<string, T>, key: string, value: T | null) => (value === null ? without(map, key) : { ...map, [key]: value });

export const useOfficeStore = create<OfficeState>()((set, get) => ({
  runtime: null,
  inbox: [],
  feed: [],
  speed: 1,
  paused: false,
  waiting: 0,
  running: 0,
  stream: "connecting",
  visitors: [],
  bubbles: {},
  held: {},
  flashes: {},
  hiddenItems: new Set(),
  rings: {},

  deliver(event) {
    set((s) => ({ feed: [event, ...s.feed].slice(0, FEED_MAX) }));
    const { runtime } = get();
    if (runtime) runtime.receive(event, hidden());
    else set((s) => ({ inbox: [...s.inbox, event] }));
  },
  attach(runtime) {
    const { inbox, speed, paused } = get();
    set({ runtime, inbox: [], visitors: [], bubbles: {}, held: {}, flashes: {}, hiddenItems: new Set(), rings: {}, waiting: 0, running: 0 });
    runtime.setSpeed(speed);
    runtime.setPaused(paused);
    for (const event of inbox) runtime.receive(event, hidden());
  },
  detach(runtime) {
    if (get().runtime === runtime) set({ runtime: null, visitors: [], bubbles: {}, held: {}, flashes: {}, hiddenItems: new Set(), rings: {}, waiting: 0, running: 0 });
  },
  setSpeed(speed) {
    set({ speed });
    get().runtime?.setSpeed(speed);
  },
  togglePaused() {
    const paused = !get().paused;
    set({ paused });
    get().runtime?.setPaused(paused);
  },
  setStream(stream) {
    set({ stream });
  },
}));

/** Fresh state for a newly opened page (the store outlives client-side navigation). */
export function resetOfficeStore() {
  useOfficeStore.setState({ runtime: null, inbox: [], feed: [], paused: false, waiting: 0, running: 0, stream: "connecting", visitors: [], bubbles: {}, held: {}, flashes: {}, hiddenItems: new Set(), rings: {} });
}
