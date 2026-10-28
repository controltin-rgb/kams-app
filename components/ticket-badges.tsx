import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import { ticketPriorityLabels, ticketPriorityTone, ticketStatusLabels, ticketStatusTone } from "@/lib/labels";

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${base} ${ticketStatusTone[status]}`}>{ticketStatusLabels[status]}</span>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return <span className={`${base} ${ticketPriorityTone[priority]}`}>{ticketPriorityLabels[priority]}</span>;
}

export type SlaState = "overdue" | "soon" | null;

/** Computed on the server when data is loaded (keeps components pure). */
export function slaState(dueAt: Date | null, status: TicketStatus, now: number): SlaState {
  if (!dueAt || ["RESOLVED", "CLOSED", "CANCELLED"].includes(status)) return null;
  const ms = dueAt.getTime() - now;
  if (ms < 0) return "overdue";
  if (ms < 2 * 3_600_000) return "soon";
  return null;
}

export function SlaBadge({ state }: { state: SlaState }) {
  if (state === "overdue") return <span className={`${base} bg-red-600 text-white`}>เกินกำหนด</span>;
  if (state === "soon") return <span className={`${base} bg-amber-500 text-white`}>ใกล้ครบกำหนด</span>;
  return null;
}
