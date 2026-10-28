import type { SceneEventMessage } from "../events";
import type { LayoutItem } from "../models";
import type { MarkerKind, SceneAgent } from "../scene";

/** Where to go. Resolved to world space by the runtime (anchors need the loaded models). */
export type Target =
  /** An anchor of a layout item; `offset` = [x, z] in the anchor's frame; `face` = look at that agent instead of the anchor direction */
  | { kind: "anchor"; item: string; anchor: string; offset?: [number, number]; face?: string }
  /** A zone of the layout (entrance, door_vendor, ...); same `offset` / `face` as anchors */
  | { kind: "zone"; zone: string; offset?: [number, number]; face?: string };

/** One step of a scene for one agent (or the whole office). Steps run in order; actions within a step run together. */
export type Action =
  /** Walk there (standing up first if seated). `reserve` = one-person spot: queue behind whoever holds it */
  | { do: "walk"; agent: string; to: Target; reserve?: string }
  /** Back to the usual place: walk, sit down if seated there, resume the usual clip */
  | { do: "home"; agent: string }
  /** One-shot clips play to the end; looping clips play for `seconds` */
  | { do: "clip"; agent: string; clip: string; seconds?: number }
  | { do: "say"; agent: string; text: string; seconds: number }
  /** Prop in hand (null = empty hand). Boxes and equipment are carried in both arms (walk_carry) */
  | { do: "hold"; agent: string; prop: string | null }
  /** Short-lived marker above an agent */
  | { do: "flash"; agent: string; marker: MarkerKind; seconds: number }
  | { do: "release"; agent: string; spot: string }
  /** Blink a status_ring around a layout item (stock-take result colour) */
  | { do: "ring"; item: string; color: string; seconds: number }
  /** Take layout items off their place for a moment (equipment being swapped) or put them back */
  | { do: "hide"; items: string[]; hidden: boolean }
  /** Temporary character (e.g. a reporter who has no desk in the office) */
  | { do: "spawn"; agent: SceneAgent; at: Target }
  | { do: "despawn"; agent: string }
  /** Apply the event to the office state (tickets, markers, lights) at this point of the scene */
  | { do: "commit"; event: SceneEventMessage };

export type Scene = {
  id: string;
  eventId: string;
  /** What the scene is about (`ticket:<id>`, `asset:<id>`): scenes sharing a subject play in event order */
  subjects: string[];
  /** Higher plays first when several scenes wait (CRITICAL > HIGH > others) */
  priority: number;
  /** Agents the scene moves; one scene per agent at a time */
  agents: string[];
  steps: Action[][];
};

/** What the director knows about the office when an event arrives. */
export type World = {
  agents: SceneAgent[];
  items: LayoutItem[];
  /** assetId → layout item showing it */
  assetItems: Record<string, string>;
};
