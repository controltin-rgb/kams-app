// Director (IMPLEMENTATION.md §7): turns one scene event into a scripted Scene. Pure and deterministic —
// the same event and office give the same steps — so scenes are unit-tested without three.js.

import type { TicketPriority } from "@/generated/prisma/enums";
import type { AuditEventPayload, MoveEventPayload, MoveEventType, PmEventPayload, PmEventType, SceneEventMessage, TicketEventPayload } from "../events";
import { isAssetModel } from "../models";
import { auditResultColors, characterFor, SLOT_FURNITURE, SLOT_RADIUS, slotAssetItems, type SceneAgent } from "../scene";
import type { Action, Scene, Target, World } from "./types";

export type { Action, Scene, Target, World } from "./types";

/** The helpdesk counter fits one visitor at a time */
export const HELPDESK_SPOT = "helpdesk-visitor";
/** More waiting scenes than this → skip ahead to the end state */
export const CATCH_UP_QUEUE = 10;
export const MAX_RUNNING = 6;

const TALK_SECONDS = 2.5;
const REPAIR_SECONDS = 4;
const HOLD_SECONDS = 3;
const CHECK_SECONDS = 3;
const SWAP_SECONDS = 3;
const INSPECT_SECONDS = 2.5;
const SCAN_SECONDS = 2;
const RING_SECONDS = 3;
/** Desks somebody sits at: stand beside them, not on the chair */
const SEATED_DESKS = new Set(["desk_staff", "desk_manager", "desk_helpdesk"]);
/** Stand beside a desk (anchor frame, metres) instead of on its chair spot */
const BESIDE: [number, number] = [0.75, 0];

const rank: Record<TicketPriority, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

function roles(world: World) {
  const at = (model: string) => {
    const item = world.items.find((i) => i.model === model);
    return item ? world.agents.find((a) => a.place.item === item.id) : undefined;
  };
  const helpdeskItem = world.items.find((i) => i.model === "desk_helpdesk");
  const shelf = world.items.filter((i) => i.model === "shelf_storage").sort((a, b) => a.id.localeCompare(b.id))[0];
  const byUser = (userId: string | null) => (userId ? world.agents.find((a) => a.userId === userId) : undefined);
  const hasRole = (a: SceneAgent, role: string) => a.role.split(",").some((r) => r.trim() === role);
  const bench = at("workbench_repair");
  return {
    byUser,
    helpdesk: at("desk_helpdesk"),
    /** Whoever stands at the workbench stands in for technicians who have no place in the office */
    bench,
    /** Who carries equipment: the person who did it if they are a technician in the office, else the workbench */
    technician: (userId: string | null) => {
      const a = byUser(userId);
      return a && hasRole(a, "technician") ? a : bench;
    },
    /** Who scans: the auditor who did it if they are in the office, else any auditor in the office */
    auditor: (userId: string | null) => {
      const a = byUser(userId);
      return a && hasRole(a, "auditor") ? a : world.agents.find((x) => hasRole(x, "auditor"));
    },
    /** Where spare parts and equipment are kept */
    store: shelf ? ({ kind: "anchor", item: shelf.id, anchor: "anchor_stand" } as const) : null,
    counter: helpdeskItem ? ({ kind: "anchor", item: helpdeskItem.id, anchor: "anchor_visitor" } as const) : null,
  };
}

/** Beside someone's usual place, facing them (handing work back, talking to a seated person). */
function beside(agent: SceneAgent): Target {
  const anchor = agent.place.anchor === "anchor_chair" ? "anchor_stand" : agent.place.anchor;
  return { kind: "anchor", item: agent.place.item, anchor, offset: BESIDE, face: agent.id };
}

/** Layout item showing an asset, and the furniture holding it (the desk of a PC set), if any. */
function placeOf(world: World, assetId: string | null) {
  const itemId = assetId ? world.assetItems[assetId] : undefined;
  const item = itemId ? world.items.find((i) => i.id === itemId) : undefined;
  if (!item) return null;
  const d = (i: { position: number[] }) => Math.hypot(i.position[0] - item.position[0], i.position[1] - item.position[1], i.position[2] - item.position[2]);
  const holder = world.items
    .filter((i) => SLOT_FURNITURE.has(i.model) && d(i) <= SLOT_RADIUS)
    .sort((a, b) => d(a) - d(b) || a.id.localeCompare(b.id))[0];
  return { item, holder };
}

/** Where to stand at a location's slot (Location.sceneSlot): beside a desk someone sits at, else at its stand anchor. */
function slotSpot(world: World, slot: string | null): Target | null {
  const item = slot ? world.items.find((i) => i.id === slot) : undefined;
  if (!item) return null;
  return SEATED_DESKS.has(item.model) ? { kind: "anchor", item: item.id, anchor: "anchor_stand", offset: BESIDE } : { kind: "anchor", item: item.id, anchor: "anchor_stand" };
}

/** Where to work on an asset: beside the furniture that holds it, else at the asset itself. */
function assetSpot(world: World, assetId: string | null): Target | null {
  const place = placeOf(world, assetId);
  if (!place) return null;
  return place.holder ? { kind: "anchor", item: place.holder.id, anchor: "anchor_stand", offset: BESIDE } : { kind: "anchor", item: place.item.id, anchor: "anchor_stand" };
}

function ticketSteps(type: SceneEventMessage["type"], t: TicketEventPayload, event: SceneEventMessage, world: World): Action[][] {
  const commit: Action = { do: "commit", event };
  const { byUser, helpdesk, bench, counter } = roles(world);
  const tech = byUser(t.assignedTechId) ?? bench;
  // The helpdesk only reacts (several scenes may use them at once); seated, they type instead of standing clips
  const desk = (clip: string): Action[] => (helpdesk ? [{ do: "clip", agent: helpdesk.id, clip: helpdesk.place.sit ? "sit_type" : clip, seconds: TALK_SECONDS }] : []);
  const deskHome: Action[] = helpdesk ? [{ do: "home", agent: helpdesk.id }] : [];

  switch (type) {
    case "TICKET_CREATED": {
      if (!counter) return [[commit]];
      const say = t.title ?? "แจ้งซ่อม";
      const reporter = byUser(t.reporterId);
      if (reporter && reporter.id === helpdesk?.id) return [[commit]]; // reported at their own counter
      const talk = (who: string): Action[] => [
        { do: "clip", agent: who, clip: "talk", seconds: TALK_SECONDS },
        { do: "say", agent: who, text: say, seconds: TALK_SECONDS },
        ...desk("talk"),
      ];
      if (reporter) {
        return [
          [{ do: "walk", agent: reporter.id, to: counter, reserve: HELPDESK_SPOT }],
          talk(reporter.id),
          [commit, { do: "release", agent: reporter.id, spot: HELPDESK_SPOT }, ...deskHome],
          [{ do: "home", agent: reporter.id }],
        ];
      }
      // Reporter without a place in the office (QR report, more people than desks): walks in from the entrance
      const visitor: SceneAgent = {
        id: `visitor-${t.ticketId}`,
        userId: null,
        name: "ผู้แจ้งซ่อม",
        role: "user",
        model: characterFor({ id: t.ticketId, name: "", role: "user" }),
        clip: "idle",
        place: { item: counter.item, anchor: counter.anchor, sit: false },
      };
      const door: Target = { kind: "zone", zone: "entrance" };
      return [
        [{ do: "spawn", agent: visitor, at: door }],
        [{ do: "walk", agent: visitor.id, to: counter, reserve: HELPDESK_SPOT }],
        talk(visitor.id),
        [commit, { do: "release", agent: visitor.id, spot: HELPDESK_SPOT }, ...deskHome],
        [{ do: "walk", agent: visitor.id, to: door }],
        [{ do: "despawn", agent: visitor.id }],
      ];
    }
    case "TICKET_ASSIGNED": {
      if (!tech || !counter) return [[commit]];
      return [
        [{ do: "walk", agent: tech.id, to: counter, reserve: HELPDESK_SPOT }, ...desk("point")],
        [{ do: "clip", agent: tech.id, clip: "handover" }, ...desk("handover")],
        [commit, { do: "hold", agent: tech.id, prop: "ticket_paper" }, { do: "release", agent: tech.id, spot: HELPDESK_SPOT }, ...deskHome],
        [{ do: "home", agent: tech.id }],
        [{ do: "hold", agent: tech.id, prop: null }],
      ];
    }
    case "TICKET_STARTED": {
      if (!tech) return [[commit]];
      const spot = assetSpot(world, t.assetId);
      if (!spot) return [[commit, { do: "home", agent: tech.id }]];
      return [
        [{ do: "walk", agent: tech.id, to: spot }],
        [commit, { do: "clip", agent: tech.id, clip: "repair_crouch", seconds: REPAIR_SECONDS }],
        [{ do: "home", agent: tech.id }],
      ];
    }
    case "TICKET_ON_HOLD": {
      if (!tech) return [[commit]];
      return [
        [commit, { do: "clip", agent: tech.id, clip: "think_wait", seconds: HOLD_SECONDS }, { do: "say", agent: tech.id, text: t.onHoldReason ?? "พักงานชั่วคราว", seconds: HOLD_SECONDS }],
        [{ do: "home", agent: tech.id }],
      ];
    }
    case "TICKET_RESOLVED": {
      if (!tech) return [[commit]];
      const reporter = byUser(t.reporterId);
      // No reporter in the office: hand the work back at the helpdesk counter
      const receiver = reporter ?? helpdesk;
      if (!receiver || receiver.id === tech.id) return [[commit, { do: "flash", agent: tech.id, marker: "check", seconds: CHECK_SECONDS }]];
      const to = reporter ? beside(reporter) : counter!;
      const thanks = receiver.place.sit ? "wave" : "celebrate";
      return [
        [{ do: "walk", agent: tech.id, to, ...(reporter ? {} : { reserve: HELPDESK_SPOT }) }],
        [
          { do: "clip", agent: tech.id, clip: "handover" },
          { do: "clip", agent: receiver.id, clip: thanks },
          { do: "flash", agent: receiver.id, marker: "check", seconds: CHECK_SECONDS },
          commit,
        ],
        [{ do: "home", agent: receiver.id }, ...(reporter ? [] : [{ do: "release", agent: tech.id, spot: HELPDESK_SPOT } as const])],
        [{ do: "home", agent: tech.id }],
      ];
    }
    case "PART_USED": {
      const { store } = roles(world);
      if (!tech || !store) return [[commit]];
      return [
        [{ do: "walk", agent: tech.id, to: store }],
        [{ do: "clip", agent: tech.id, clip: "pickup" }],
        [{ do: "hold", agent: tech.id, prop: "parts_box" }],
        [{ do: "home", agent: tech.id }],
        [{ do: "clip", agent: tech.id, clip: "putdown" }],
        [commit, { do: "hold", agent: tech.id, prop: null }],
        [{ do: "home", agent: tech.id }],
      ];
    }
    default:
      // CLOSED / CANCELLED / priority changes: markers only
      return [[commit]];
  }
}

/** Swaps and claims (IMPLEMENTATION.md §7): equipment carried between the store, desks, the vendor door and the counter. */
function moveSteps(type: MoveEventType, m: MoveEventPayload, event: SceneEventMessage, world: World): Action[][] {
  const commit: Action = { do: "commit", event };
  const { technician, store, counter, helpdesk } = roles(world);
  const tech = technician(m.performerId);
  if (!tech) return [[commit]];
  const desk = (clip: string): Action[] => (helpdesk ? [{ do: "clip", agent: helpdesk.id, clip: helpdesk.place.sit ? "sit_type" : clip, seconds: TALK_SECONDS }] : []);
  const courier: SceneAgent = {
    id: `courier-${m.refId}`,
    userId: null,
    name: "พนักงานขนส่ง",
    role: "courier",
    model: "char_courier",
    clip: "idle",
    place: { item: "", anchor: "", sit: false },
  };
  const entrance: Target = { kind: "zone", zone: "entrance" };

  switch (type) {
    case "SWAP_PARTIAL":
    case "SWAP_FULL": {
      const place = placeOf(world, m.outAssetId);
      const spot = assetSpot(world, m.outAssetId);
      if (!store || !place || !spot) return [[commit]];
      // A part travels as itself; a whole set is packed in a big box
      const full = type === "SWAP_FULL";
      const prop = full ? "box_large" : m.model && isAssetModel(m.model) ? m.model : "box_small";
      const items = full && place.holder ? slotAssetItems(world.items, place.holder.id).map((i) => i.id) : [place.item.id];
      return [
        [{ do: "walk", agent: tech.id, to: store }],
        [{ do: "clip", agent: tech.id, clip: "pickup" }],
        [{ do: "hold", agent: tech.id, prop }],
        [{ do: "walk", agent: tech.id, to: spot }],
        [{ do: "hold", agent: tech.id, prop: null }, { do: "hide", items, hidden: true }, { do: "clip", agent: tech.id, clip: "repair_crouch", seconds: SWAP_SECONDS }],
        // The replacement is in place (assets reload); the old one goes back to the store
        [commit, { do: "hide", items, hidden: false }, { do: "hold", agent: tech.id, prop }],
        [{ do: "walk", agent: tech.id, to: store }],
        [{ do: "clip", agent: tech.id, clip: "putdown" }],
        [{ do: "hold", agent: tech.id, prop: null }],
        [{ do: "home", agent: tech.id }],
      ];
    }
    case "CLAIM_SENT": {
      const pickup = assetSpot(world, m.outAssetId) ?? store;
      if (!pickup) return [[commit]];
      // Handover at the vendor door: technician inside, courier between them and the door
      const techSpot: Target = { kind: "zone", zone: "door_vendor", offset: [0, -1], face: courier.id };
      const courierSpot: Target = { kind: "zone", zone: "door_vendor", offset: [0, -0.25], face: tech.id };
      return [
        [{ do: "walk", agent: tech.id, to: pickup }],
        [{ do: "clip", agent: tech.id, clip: "pickup" }],
        [{ do: "hold", agent: tech.id, prop: "box_large" }],
        [{ do: "walk", agent: tech.id, to: techSpot }, { do: "spawn", agent: courier, at: entrance }],
        [{ do: "walk", agent: courier.id, to: courierSpot }],
        [{ do: "clip", agent: tech.id, clip: "handover" }, { do: "clip", agent: courier.id, clip: "handover" }],
        [commit, { do: "hold", agent: tech.id, prop: null }, { do: "hold", agent: courier.id, prop: "box_large" }],
        [{ do: "walk", agent: courier.id, to: entrance }, { do: "home", agent: tech.id }],
        [{ do: "hold", agent: courier.id, prop: null }, { do: "despawn", agent: courier.id }],
      ];
    }
    case "CLAIM_RETURNED": {
      if (!counter) return [[commit]];
      return [
        [{ do: "spawn", agent: courier, at: entrance }],
        [{ do: "hold", agent: courier.id, prop: "package_courier" }],
        [{ do: "walk", agent: courier.id, to: counter, reserve: HELPDESK_SPOT }],
        [{ do: "clip", agent: courier.id, clip: "handover" }, ...desk("handover")],
        // The courier leaves the parcel on the counter; the technician collects it for the lab
        [
          { do: "hold", agent: courier.id, prop: null },
          { do: "release", agent: courier.id, spot: HELPDESK_SPOT },
          { do: "walk", agent: courier.id, to: entrance },
          { do: "walk", agent: tech.id, to: counter, reserve: HELPDESK_SPOT },
        ],
        [{ do: "clip", agent: tech.id, clip: "pickup" }, { do: "despawn", agent: courier.id }],
        [commit, { do: "hold", agent: tech.id, prop: "package_courier" }, { do: "release", agent: tech.id, spot: HELPDESK_SPOT }, ...(helpdesk ? [{ do: "home", agent: helpdesk.id } as const] : [])],
        [{ do: "home", agent: tech.id }],
        [{ do: "clip", agent: tech.id, clip: "putdown" }],
        [{ do: "hold", agent: tech.id, prop: null }],
        [{ do: "home", agent: tech.id }],
      ];
    }
  }
}

/** PM (IMPLEMENTATION.md §7): the technician walks the round with a clipboard, inspecting each place; a check when done. */
function pmSteps(type: PmEventType, p: PmEventPayload, event: SceneEventMessage, world: World): Action[][] {
  const commit: Action = { do: "commit", event };
  const tech = roles(world).technician(p.technicianId);
  if (!tech) return [[commit]];
  if (type === "PM_DONE") return [[commit, { do: "flash", agent: tech.id, marker: "check", seconds: CHECK_SECONDS }]];
  const stops = p.slots.map((slot) => slotSpot(world, slot)).filter((t): t is Target => !!t);
  const inspect: Action = { do: "clip", agent: tech.id, clip: "inspect_clipboard", seconds: INSPECT_SECONDS };
  return [
    [commit, { do: "hold", agent: tech.id, prop: "clipboard" }],
    // No place of the schedule in the office: checks the list at the bench
    ...(stops.length ? stops.flatMap((to): Action[][] => [[{ do: "walk", agent: tech.id, to }], [inspect]]) : [[inspect]]),
    [{ do: "home", agent: tech.id }],
    [{ do: "hold", agent: tech.id, prop: null }],
  ];
}

/** Stock take (§7): the auditor scans with a phone where the asset is; a ring blinks in the result colour. */
function auditSteps(a: AuditEventPayload, event: SceneEventMessage, world: World): Action[][] {
  const commit: Action = { do: "commit", event };
  const ringAt = (a.assetId && world.assetItems[a.assetId]) || a.slot;
  if (!ringAt) return [[commit]];
  const ring: Action = { do: "ring", item: ringAt, color: auditResultColors[a.result], seconds: RING_SECONDS };
  const auditor = roles(world).auditor(a.scannedById);
  const spot = assetSpot(world, a.assetId) ?? slotSpot(world, a.slot);
  if (!auditor || !spot) return [[commit, ring]];
  return [
    [{ do: "hold", agent: auditor.id, prop: "smartphone" }],
    [{ do: "walk", agent: auditor.id, to: spot }],
    [{ do: "clip", agent: auditor.id, clip: "scan_phone", seconds: SCAN_SECONDS }],
    [commit, ring],
    [{ do: "home", agent: auditor.id }],
    [{ do: "hold", agent: auditor.id, prop: null }],
  ];
}

/** Agents a scene owns: everyone it moves except the helpdesk, who is shared */
const agentsOf = (steps: Action[][], shared: string | undefined) => {
  const ids = new Set<string>();
  for (const step of steps) for (const a of step) if ("agent" in a) ids.add(typeof a.agent === "string" ? a.agent : a.agent.id);
  if (shared) ids.delete(shared);
  return [...ids].sort();
};

/** Plan the scene for one event. */
export function planScene(event: SceneEventMessage, world: World): Scene {
  const id = `scene-${event.id}`;
  const shared = roles(world).helpdesk?.id;
  if (event.type === "ASSET_STATUS_CHANGED") {
    return { id, eventId: event.id, subjects: [`asset:${event.asset.assetId}`], priority: 0, agents: [], steps: [[{ do: "commit", event }]] };
  }
  if ("pm" in event) {
    const steps = pmSteps(event.type, event.pm, event, world);
    return { id, eventId: event.id, subjects: [`pm:${event.pm.runId}`], priority: 1, agents: agentsOf(steps, shared), steps };
  }
  if ("audit" in event) {
    const steps = auditSteps(event.audit, event, world);
    const subjects = event.audit.assetId ? [`asset:${event.audit.assetId}`] : [];
    return { id, eventId: event.id, subjects, priority: 0, agents: agentsOf(steps, shared), steps };
  }
  if ("move" in event) {
    const steps = moveSteps(event.type, event.move, event, world);
    const subjects = [event.move.outAssetId, event.move.inAssetId].filter((a): a is string => !!a).map((a) => `asset:${a}`);
    return { id, eventId: event.id, subjects, priority: 1, agents: agentsOf(steps, shared), steps };
  }
  const steps = ticketSteps(event.type, event.ticket, event, world);
  return { id, eventId: event.id, subjects: [`ticket:${event.ticket.ticketId}`], priority: rank[event.ticket.priority], agents: agentsOf(steps, shared), steps };
}

const byEvent = (a: Scene, b: Scene) => (BigInt(a.eventId) < BigInt(b.eventId) ? -1 : BigInt(a.eventId) > BigInt(b.eventId) ? 1 : 0);

/**
 * Which waiting scenes may start now: none of their agents busy, nothing earlier waiting for the same agents or subjects
 * (one ticket's scenes stay in order; an asset's light waits for the swap/claim carrying it), at most MAX_RUNNING at
 * once, higher priority first.
 */
export function nextScenes(waiting: Scene[], running: Scene[], max = MAX_RUNNING): Scene[] {
  const agents = new Set(running.flatMap((s) => s.agents));
  const subjects = new Set(running.flatMap((s) => s.subjects));
  const ready: Scene[] = [];
  for (const s of [...waiting].sort(byEvent)) {
    const free = s.agents.every((a) => !agents.has(a)) && s.subjects.every((x) => !subjects.has(x));
    if (free) ready.push(s);
    s.agents.forEach((a) => agents.add(a));
    s.subjects.forEach((x) => subjects.add(x));
  }
  return ready.sort((a, b) => b.priority - a.priority || byEvent(a, b)).slice(0, Math.max(0, max - running.length));
}
