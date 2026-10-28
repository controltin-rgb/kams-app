// Pure scene logic (client-safe, no three.js): item ids, slot → asset matching, seating, markers.
// Kept free of I/O so it can be unit-tested and shared by the snapshot route and the client.

import type { AssetStatus, AuditResult, TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import type { AuditTally, SceneEventMessage, TicketEventPayload } from "./events";
import { isAssetModel, isCharacterModel, type CharacterModel, type LayoutItem, type SceneLayoutConfig } from "./models";

/** Asset items within this distance (metres, 3D so wall-mounted items above furniture stay separate) of a slot item belong to it, e.g. the PC set on a desk. */
export const SLOT_RADIUS = 1;

export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED"];
const WAITING_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

/** Status light colours, matching the status labels of the system (IMPLEMENTATION.md §2.3). */
export const assetStatusColors: Record<AssetStatus, string> = {
  ACTIVE: "#5DBB63",
  IN_USE: "#5DBB63",
  IN_MAINTENANCE: "#F2C94C",
  CLAIMING: "#D2493F",
  SPARE: "#5B86C5",
  PENDING_DISPOSAL: "#9AA0A6",
  DISPOSED: "#9AA0A6",
};
export const DEFAULT_STATUS_COLOR = assetStatusColors.ACTIVE;

/** Stock-take results (status_ring), as in IMPLEMENTATION.md §7 */
export const auditResultColors: Record<AuditResult, string> = {
  MATCHED: "#5DBB63",
  RELOCATED: "#F2C94C",
  MISSING: "#D2493F",
  UNREGISTERED: "#9B7BD0",
};

export const priorityColors: Record<TicketPriority, string> = {
  CRITICAL: "#D2493F",
  HIGH: "#EB7A3C",
  MEDIUM: "#F2C94C",
  LOW: "#5B86C5",
};
const priorityRank: Record<TicketPriority, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

// ---------- Layout ----------

/** Give every layout item a stable id: `<model>-<NN>` numbered in layout order, e.g. desk_staff-01. */
export function withItemIds(items: Omit<LayoutItem, "id">[]): LayoutItem[] {
  const seen: Record<string, number> = {};
  return items.map((it) => {
    seen[it.model] = (seen[it.model] ?? 0) + 1;
    return { ...it, id: `${it.model}-${String(seen[it.model]).padStart(2, "0")}` };
  });
}

const dist = (a: LayoutItem, b: LayoutItem) => Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);

/** Asset items shown at a slot: the slot itself if it is an asset, else the asset items around it. */
export function slotAssetItems(items: LayoutItem[], slotId: string): LayoutItem[] {
  const slot = items.find((i) => i.id === slotId);
  if (!slot) return [];
  if (isAssetModel(slot.model)) return [slot];
  return items.filter((i) => isAssetModel(i.model) && dist(i, slot) <= SLOT_RADIUS).sort((a, b) => dist(a, slot) - dist(b, slot));
}

/** Furniture that holds assets and can stand for a location (chairs, boards etc. only happen to be nearby). */
export const SLOT_FURNITURE = new Set(["desk_staff", "desk_manager", "desk_helpdesk", "printer_station", "workbench_repair", "shelf_storage", "rack_server", "meeting_table"]);

/** Items a Location can be bound to (Location.sceneSlot): furniture holding assets, or standalone assets. */
export function slotOptions(items: LayoutItem[]): { id: string; models: string[] }[] {
  const furniture = items.filter((i) => SLOT_FURNITURE.has(i.model)).map((i) => ({ id: i.id, models: slotAssetItems(items, i.id).map((a) => a.model) }));
  const holders = furniture.filter((f) => f.models.length > 0);
  const covered = new Set(holders.flatMap((h) => slotAssetItems(items, h.id).map((a) => a.id)));
  const standalone = items.filter((i) => isAssetModel(i.model) && !covered.has(i.id)).map((i) => ({ id: i.id, models: [i.model] }));
  return [...holders, ...standalone];
}

export type SlotAssets = { sceneSlot: string; assets: { id: string; assetCode: string; sceneModel: string }[] };

/** Match each bound location's assets to the asset items of its slot by model (asset code order). itemId → assetId */
export function matchAssets(items: LayoutItem[], slots: SlotAssets[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const slot of slots) {
    const free = slotAssetItems(items, slot.sceneSlot).filter((i) => !out.has(i.id));
    for (const asset of [...slot.assets].sort((a, b) => a.assetCode.localeCompare(b.assetCode))) {
      const idx = free.findIndex((i) => i.model === asset.sceneModel);
      if (idx < 0) continue;
      out.set(free[idx].id, asset.id);
      free.splice(idx, 1);
    }
  }
  return out;
}

// ---------- People ----------

export type ScenePerson = { id: string; name: string; role: string };
export type SceneTicket = {
  id: string;
  ticketNumber: string;
  /** null when the viewer may not see this ticket */
  title: string | null;
  canView: boolean;
  status: TicketStatus;
  priority: TicketPriority;
  reporterId: string | null;
  assignedTechId: string | null;
  assetId: string | null;
  dueAt: string | null;
  overdue: boolean;
  /** Why the work is paused (ON_HOLD), null unless the viewer may open the ticket */
  onHoldReason: string | null;
};

export type AgentPlace = {
  /** Layout item the agent is placed at */
  item: string;
  /** Anchor of that item; for `sit`, the chair nearest to it is used */
  anchor: string;
  sit: boolean;
};
export type SceneAgent = {
  id: string;
  userId: string | null;
  name: string;
  role: string;
  model: CharacterModel;
  clip: string;
  place: AgentPlace;
};

const hasRole = (p: { role: string }, r: string) => p.role.split(",").some((x) => x.trim() === r);

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Character for a user: chosen avatar, else by role (staff look picked by a hash of the id so it never changes). */
export function characterFor(person: ScenePerson, chosen?: string | null): CharacterModel {
  if (chosen && isCharacterModel(chosen)) return chosen;
  if (hasRole(person, "manager") || hasRole(person, "admin")) return "char_manager";
  if (hasRole(person, "helpdesk")) return "char_helpdesk";
  if (hasRole(person, "technician")) return "char_technician";
  if (hasRole(person, "auditor")) return "char_auditor";
  return (["char_staff_a", "char_staff_b", "char_staff_c"] as const)[hash(person.id) % 3];
}

export type SeatingInput = {
  items: LayoutItem[];
  people: ScenePerson[];
  avatars: { userId: string; model: string; deskSlot: string | null }[];
  tickets: SceneTicket[];
};

const byName = (a: ScenePerson, b: ScenePerson) => a.name.localeCompare(b.name, "th") || a.id.localeCompare(b.id);

/**
 * Who is shown where (IMPLEMENTATION.md §8 3D-1):
 * staff desks ← avatars with a desk, then users with waiting tickets, then other users (name order);
 * manager desk ← a manager; helpdesk ← a helpdesk user; workbench ← the busiest technician; storage ← an auditor.
 * Missing helpdesk/technician are filled with extras so the office always looks staffed.
 */
export function seatAgents({ items, people, avatars, tickets }: SeatingInput): SceneAgent[] {
  const avatarOf = new Map(avatars.map((a) => [a.userId, a]));
  const placed = new Set<string>();
  const agents: SceneAgent[] = [];
  const add = (p: ScenePerson, clip: string, place: AgentPlace) => {
    placed.add(p.id);
    agents.push({ id: `user-${p.id}`, userId: p.id, name: p.name, role: p.role, model: characterFor(p, avatarOf.get(p.id)?.model), clip, place });
  };
  const free = (p: ScenePerson) => !placed.has(p.id);
  const ofType = (model: string) => items.filter((i) => i.model === model).sort((a, b) => a.id.localeCompare(b.id));
  const sorted = [...people].sort(byName);

  // Staff desks
  const desks = ofType("desk_staff");
  const deskIds = new Set(desks.map((d) => d.id));
  const taken = new Set<string>();
  for (const p of sorted) {
    const slot = avatarOf.get(p.id)?.deskSlot;
    if (slot && deskIds.has(slot) && !taken.has(slot)) {
      taken.add(slot);
      add(p, "sit_type", { item: slot, anchor: "anchor_chair", sit: true });
    }
  }
  const waiting = new Set(tickets.filter((t) => WAITING_STATUSES.includes(t.status) && t.reporterId).map((t) => t.reporterId));
  const staff = sorted.filter((p) => hasRole(p, "user") && free(p)).sort((a, b) => Number(waiting.has(b.id)) - Number(waiting.has(a.id)));
  for (const desk of desks.filter((d) => !taken.has(d.id))) {
    const p = staff.shift();
    if (!p) break;
    add(p, "sit_type", { item: desk.id, anchor: "anchor_chair", sit: true });
  }

  const manager = ofType("desk_manager")[0];
  const boss = sorted.find((p) => hasRole(p, "manager") && free(p));
  if (manager && boss) add(boss, "sit_type", { item: manager.id, anchor: "anchor_chair", sit: true });

  const helpdesk = ofType("desk_helpdesk")[0];
  if (helpdesk) {
    const place = { item: helpdesk.id, anchor: "anchor_chair", sit: true };
    const hd = sorted.find((p) => hasRole(p, "helpdesk") && free(p));
    if (hd) add(hd, "sit_idle", place);
    else agents.push({ id: "extra-helpdesk", userId: null, name: "เจ้าหน้าที่ Helpdesk", role: "helpdesk", model: "char_helpdesk", clip: "sit_idle", place });
  }

  const bench = ofType("workbench_repair")[0];
  if (bench) {
    const place = { item: bench.id, anchor: "anchor_stand", sit: false };
    const load = (id: string) => tickets.filter((t) => t.assignedTechId === id && WAITING_STATUSES.includes(t.status)).length;
    const tech = sorted.filter((p) => hasRole(p, "technician") && free(p)).sort((a, b) => load(b.id) - load(a.id))[0];
    if (tech) add(tech, "repair_stand", place);
    else agents.push({ id: "extra-technician", userId: null, name: "ช่างเทคนิค", role: "technician", model: "char_technician", clip: "repair_stand", place });
  }

  const shelf = ofType("shelf_storage")[1] ?? ofType("shelf_storage")[0];
  const auditor = sorted.find((p) => hasRole(p, "auditor") && free(p));
  if (shelf && auditor) add(auditor, "inspect_clipboard", { item: shelf.id, anchor: "anchor_stand", sit: false });

  return agents;
}

// ---------- Markers ----------

export type MarkerKind = "alert" | "wrench" | "pause" | "check";
export type SceneMarker = {
  id: string;
  kind: MarkerKind;
  /** Agent the marker floats above */
  agentId: string;
  /** Stack position above that agent (0 = lowest) */
  level: number;
  /** Recolours mat_accent; null keeps the model's own colour (wrench blue, pause yellow) */
  color: string | null;
  blink: boolean;
  reason: "reported" | "overdue" | "working" | "onHold";
  ticketIds: string[];
};

/**
 * Persistent signals from the tickets (IMPLEMENTATION.md §7): waiting tickets above the reporter (colour = highest priority),
 * overdue work above the technician, and a wrench / pause above technicians with work in progress / on hold.
 */
export function buildMarkers(agents: SceneAgent[], tickets: SceneTicket[]): SceneMarker[] {
  const agentOf = new Map(agents.filter((a) => a.userId).map((a) => [a.userId as string, a]));
  const markers: SceneMarker[] = [];
  const group = (key: (t: SceneTicket) => string | null, list: SceneTicket[]) => {
    const out = new Map<string, SceneTicket[]>();
    for (const t of list) {
      const k = key(t);
      if (k && agentOf.has(k)) out.set(k, [...(out.get(k) ?? []), t]);
    }
    return out;
  };

  for (const [userId, list] of group((t) => t.reporterId, tickets.filter((t) => WAITING_STATUSES.includes(t.status)))) {
    const top = list.reduce((a, b) => (priorityRank[b.priority] > priorityRank[a.priority] ? b : a));
    const agent = agentOf.get(userId)!;
    markers.push({ id: `reported-${agent.id}`, kind: "alert", agentId: agent.id, level: 0, color: priorityColors[top.priority], blink: top.priority === "CRITICAL", reason: "reported", ticketIds: list.map((t) => t.id) });
  }
  const technician = (reason: SceneMarker["reason"], kind: MarkerKind, list: SceneTicket[], color: string | null, blink: boolean) => {
    for (const [userId, mine] of group((t) => t.assignedTechId, list)) {
      const agent = agentOf.get(userId)!;
      markers.push({ id: `${reason}-${agent.id}`, kind, agentId: agent.id, level: 0, color, blink, reason, ticketIds: mine.map((t) => t.id) });
    }
  };
  technician("overdue", "alert", tickets.filter((t) => t.overdue), priorityColors.CRITICAL, true);
  technician("working", "wrench", tickets.filter((t) => t.status === "IN_PROGRESS"), null, false);
  technician("onHold", "pause", tickets.filter((t) => t.status === "ON_HOLD"), null, false);

  // Stack markers that share an agent, in the order added
  const levels = new Map<string, number>();
  return markers.map((m) => {
    const level = levels.get(m.agentId) ?? 0;
    levels.set(m.agentId, level + 1);
    return { ...m, level };
  });
}

export const isWaiting = (status: TicketStatus) => WAITING_STATUSES.includes(status);

/** Tickets waiting at the helpdesk (badge) */
export const countOpen = (tickets: SceneTicket[]) => tickets.filter((t) => isWaiting(t.status)).length;

export function sceneTicket(t: Omit<TicketEventPayload, "ticketId"> & { id: string; canView: boolean }, now: number): SceneTicket {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.canView ? t.title : null,
    canView: t.canView,
    status: t.status,
    priority: t.priority,
    reporterId: t.reporterId,
    assignedTechId: t.assignedTechId,
    assetId: t.assetId,
    dueAt: t.dueAt,
    overdue: !!t.dueAt && new Date(t.dueAt).getTime() < now && isWaiting(t.status),
    onHoldReason: t.canView ? t.onHoldReason : null,
  };
}

/** The snapshot after one live event: ticket upserted (or dropped when closed), asset light changed, markers rebuilt. */
export function applySceneEvent(snap: OfficeSnapshot, e: SceneEventMessage, now: number): OfficeSnapshot {
  // Swaps and claims move assets between places: the page reloads the bound assets after them
  if ("move" in e || "pm" in e) return snap;
  if (e.type === "AUDIT_SCAN") {
    const { campaignId, tally } = e.audit;
    if (!tally) return snap;
    // A scan of the campaign shown keeps its numbers current; another campaign shows up on the next snapshot
    if (snap.audit && snap.audit.campaignId !== campaignId) return snap;
    return { ...snap, audit: { campaignId, title: snap.audit?.title ?? null, expected: snap.audit?.expected ?? null, tally } };
  }
  if (e.type === "ASSET_STATUS_CHANGED") {
    if (!snap.assets.some((a) => a.id === e.asset.assetId)) return snap;
    return { ...snap, assets: snap.assets.map((a) => (a.id === e.asset.assetId ? { ...a, status: e.asset.status } : a)) };
  }
  const { ticketId, ...rest } = e.ticket;
  const others = snap.tickets.filter((t) => t.id !== ticketId);
  const tickets = ACTIVE_TICKET_STATUSES.includes(rest.status) ? [...others, sceneTicket({ ...rest, id: ticketId }, now)] : others;
  return { ...snap, tickets, markers: buildMarkers(snap.agents, tickets), openCount: countOpen(tickets) };
}

/** Data the client renders: everything is already filtered for the viewer. */
export type OfficeSnapshot = {
  lastEventId: string | null;
  layoutId: string | null;
  layout: SceneLayoutConfig;
  agents: SceneAgent[];
  tickets: SceneTicket[];
  assets: { id: string; assetCode: string | null; name: string | null; status: AssetStatus; itemId: string }[];
  markers: SceneMarker[];
  /** Tickets waiting at the helpdesk (badge) */
  openCount: number;
  /** Stock take being counted (only for viewers who may see stock takes) */
  audit: SceneAudit | null;
};

export type SceneAudit = { campaignId: string; title: string | null; expected: number | null; tally: AuditTally };
export const scannedCount = (t: AuditTally) => t.MATCHED + t.RELOCATED + t.UNREGISTERED;
