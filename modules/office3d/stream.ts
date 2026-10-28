// Turning SceneEvent rows into what one viewer may see (shared by the SSE route; no I/O, so it is unit-tested).

import { can } from "@/lib/permissions";
import { ticketAbilities } from "@/modules/tickets/workflow";
import { assetEventPayload, auditEventPayload, isMoveEvent, isPmEvent, isTicketEvent, moveEventPayload, pmEventPayload, ticketEventPayload, type SceneEventMessage } from "./events";

type Viewer = { id: string; role: string | null | undefined };
type Row = { id: bigint; type: string; payload: unknown; createdAt: Date };

/**
 * Same rule as the snapshot: ticket titles and hold reasons only for viewers who may open the ticket.
 * Rows that no longer parse (older payload versions, unknown types) are skipped.
 */
export function toMessage(row: Row, viewer: Viewer): SceneEventMessage | null {
  const base = { id: row.id.toString(), at: row.createdAt.toISOString() };
  if (isTicketEvent(row.type)) {
    const parsed = ticketEventPayload.safeParse(row.payload);
    if (!parsed.success) return null;
    const t = parsed.data;
    const canView = ticketAbilities(viewer, t).view;
    return { ...base, type: row.type, ticket: { ...t, title: canView ? t.title : null, onHoldReason: canView ? t.onHoldReason : null, canView } };
  }
  if (isMoveEvent(row.type)) {
    const parsed = moveEventPayload.safeParse(row.payload);
    if (!parsed.success) return null;
    // Asset ids only place the scene; the document number is shown to people who may look at assets
    return { ...base, type: row.type, move: { ...parsed.data, docNumber: can(viewer.role, "asset", "view") ? parsed.data.docNumber : null } };
  }
  if (isPmEvent(row.type)) {
    const parsed = pmEventPayload.safeParse(row.payload);
    if (!parsed.success) return null;
    return { ...base, type: row.type, pm: { ...parsed.data, title: can(viewer.role, "pm", "view") ? parsed.data.title : null } };
  }
  if (row.type === "AUDIT_SCAN") {
    const parsed = auditEventPayload.safeParse(row.payload);
    if (!parsed.success) return null;
    // Everyone sees the scan happen; the campaign's numbers are for people who may look at stock takes
    return { ...base, type: row.type, audit: { ...parsed.data, tally: can(viewer.role, "audit", "view") ? parsed.data.tally : null } };
  }
  if (row.type === "ASSET_STATUS_CHANGED") {
    const parsed = assetEventPayload.safeParse(row.payload);
    return parsed.success ? { ...base, type: row.type, asset: parsed.data } : null;
  }
  return null;
}

/** One SSE frame; the id lets EventSource resume with Last-Event-ID after a reconnect. */
export const sseFrame = (m: SceneEventMessage) => `id: ${m.id}\nevent: scene\ndata: ${JSON.stringify(m)}\n\n`;
