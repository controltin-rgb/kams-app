// Scene events (IMPLEMENTATION.md §7): written by AMS actions in the same transaction (emit.ts),
// streamed to the 3D Office over SSE. Client-safe: types and schemas only.

import { z } from "zod";
import { AssetStatus, AuditResult, TicketPriority, TicketStatus } from "@/generated/prisma/enums";

export const TICKET_EVENT_TYPES = [
  "TICKET_CREATED",
  "TICKET_ASSIGNED",
  "TICKET_STARTED",
  "TICKET_ON_HOLD",
  "TICKET_RESOLVED",
  "TICKET_CLOSED",
  /** A part was added to the ticket's repair */
  "PART_USED",
  /** Priority/SLA changed: no scene, only markers */
  "TICKET_UPDATED",
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];
/** Assets carried around the office: swaps at a desk, claims sent to / returned from a vendor */
export const MOVE_EVENT_TYPES = ["SWAP_PARTIAL", "SWAP_FULL", "CLAIM_SENT", "CLAIM_RETURNED"] as const;
export type MoveEventType = (typeof MOVE_EVENT_TYPES)[number];
/** Preventive maintenance runs */
export const PM_EVENT_TYPES = ["PM_STARTED", "PM_DONE"] as const;
export type PmEventType = (typeof PM_EVENT_TYPES)[number];
export type SceneEventType = TicketEventType | MoveEventType | PmEventType | "AUDIT_SCAN" | "ASSET_STATUS_CHANGED";

const TITLE_MAX = 40;
const REASON_MAX = 80;
const clip = (max: number) => z.string().transform((s) => (s.length > max ? `${s.slice(0, max - 1)}…` : s));

/** The least a scene needs to know about a ticket. zod strips every other field, so nothing sensitive leaks into the table. */
export const ticketEventPayload = z.object({
  ticketId: z.string(),
  ticketNumber: z.string(),
  title: clip(TITLE_MAX).nullable(),
  status: z.enum(TicketStatus),
  priority: z.enum(TicketPriority),
  reporterId: z.string().nullable(),
  assignedTechId: z.string().nullable(),
  assetId: z.string().nullable(),
  dueAt: z.string().nullable(),
  onHoldReason: clip(REASON_MAX).nullable(),
});
export type TicketEventPayload = z.output<typeof ticketEventPayload>;

export const assetEventPayload = z.object({ assetId: z.string(), status: z.enum(AssetStatus) });
export type AssetEventPayload = z.output<typeof assetEventPayload>;

/**
 * A swap or claim. `outAssetId` leaves its place (old part / old set / asset sent to the vendor or returned from it),
 * `inAssetId` takes it (the replacement); `model` = scene model of what is carried; `performerId` = who did it.
 */
export const moveEventPayload = z.object({
  refId: z.string(),
  /** Document / claim number; null for viewers who may not see assets */
  docNumber: z.string().nullable(),
  outAssetId: z.string().nullable(),
  inAssetId: z.string().nullable(),
  model: z.string().nullable(),
  performerId: z.string().nullable(),
});
export type MoveEventPayload = z.output<typeof moveEventPayload>;

/** Most places a PM round visits in the office */
export const PM_MAX_SLOTS = 6;

/** A PM run: `slots` = layout items (Location.sceneSlot) the technician visits, in order */
export const pmEventPayload = z.object({
  runId: z.string(),
  /** Schedule title; null for viewers who may not see PM */
  title: clip(TITLE_MAX).nullable(),
  assetId: z.string().nullable(),
  slots: z.array(z.string()).max(PM_MAX_SLOTS),
  technicianId: z.string().nullable(),
  /** PM_DONE: checklist items that failed */
  failed: z.number().int().nullable(),
});
export type PmEventPayload = z.output<typeof pmEventPayload>;

export const auditTallySchema = z.object({ MATCHED: z.number().int(), RELOCATED: z.number().int(), MISSING: z.number().int(), UNREGISTERED: z.number().int() });
export type AuditTally = z.output<typeof auditTallySchema>;

/** One stock-take scan: where it happened (`slot`) and the campaign's tallies after it */
export const auditEventPayload = z.object({
  campaignId: z.string(),
  result: z.enum(AuditResult),
  assetId: z.string().nullable(),
  slot: z.string().nullable(),
  scannedById: z.string().nullable(),
  /** null for viewers who may not see stock takes */
  tally: auditTallySchema.nullable(),
});
export type AuditEventPayload = z.output<typeof auditEventPayload>;

/** One event as the client receives it (already filtered for the viewer by the stream route). */
export type SceneEventMessage =
  | { id: string; type: TicketEventType; at: string; ticket: TicketEventPayload & { canView: boolean } }
  | { id: string; type: MoveEventType; at: string; move: MoveEventPayload }
  | { id: string; type: PmEventType; at: string; pm: PmEventPayload }
  | { id: string; type: "AUDIT_SCAN"; at: string; audit: AuditEventPayload }
  | { id: string; type: "ASSET_STATUS_CHANGED"; at: string; asset: AssetEventPayload };

export const isTicketEvent = (type: string): type is TicketEventType => (TICKET_EVENT_TYPES as readonly string[]).includes(type);
export const isMoveEvent = (type: string): type is MoveEventType => (MOVE_EVENT_TYPES as readonly string[]).includes(type);
export const isPmEvent = (type: string): type is PmEventType => (PM_EVENT_TYPES as readonly string[]).includes(type);
