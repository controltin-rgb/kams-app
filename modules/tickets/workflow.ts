import type { TicketStatus } from "@/generated/prisma/enums";
import { can } from "@/lib/permissions";

/** Allowed status transitions (client-safe; enforced again on the server). */
export const transitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

export const finalStatuses: TicketStatus[] = ["CLOSED", "CANCELLED"];

export type TicketAbilities = {
  view: boolean;
  /** Work on the ticket: status, repair notes, parts, internal notes */
  work: boolean;
  assign: boolean;
  comment: boolean;
  internalNotes: boolean;
  attach: boolean;
  /** Target statuses this user may move the ticket to */
  nextStatuses: TicketStatus[];
};

/**
 * Per-ticket permissions (CLAUDE.md §6):
 * user → own tickets; technician → assigned tickets; manager/admin (viewAll, assign) → everything.
 */
export function ticketAbilities(
  user: { id: string; role: string | null | undefined },
  ticket: { reporterId: string | null; assignedTechId: string | null; status: TicketStatus },
): TicketAbilities {
  const role = user.role;
  const isReporter = !!ticket.reporterId && ticket.reporterId === user.id;
  const isAssignee = !!ticket.assignedTechId && ticket.assignedTechId === user.id;
  const viewAll = can(role, "ticket", "viewAll");
  const assign = can(role, "ticket", "assign");
  const view = viewAll || isReporter || isAssignee;
  const work = assign || (can(role, "ticket", "update") && isAssignee);
  const closeOk = can(role, "ticket", "close") && (isAssignee || assign);
  const open = !finalStatuses.includes(ticket.status);

  const nextStatuses = transitions[ticket.status].filter((to) => {
    if (to === "CLOSED") return closeOk;
    if (to === "CANCELLED") return assign || (isReporter && ticket.status === "OPEN");
    // Reporter may reopen a resolved ticket if the problem is still there
    if (to === "IN_PROGRESS" && ticket.status === "RESOLVED") return work || isReporter;
    return work;
  });

  return {
    view,
    work: work && open,
    assign: assign && open,
    comment: view && open,
    internalNotes: work,
    attach: view && open,
    nextStatuses: view ? nextStatuses : [],
  };
}
