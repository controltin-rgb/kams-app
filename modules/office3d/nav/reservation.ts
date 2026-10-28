/**
 * Standing spots that fit one person at a time (e.g. the helpdesk counter): the first in line holds the spot,
 * the others queue behind at QUEUE_GAP metres and move up when someone leaves.
 */
export const QUEUE_GAP = 0.8;

export class Reservations {
  private lines = new Map<string, string[]>();

  /** Join the line (idempotent); returns the place in it, 0 = at the spot. */
  join(spot: string, agentId: string) {
    const line = this.lines.get(spot) ?? [];
    if (!line.includes(agentId)) line.push(agentId);
    this.lines.set(spot, line);
    return line.indexOf(agentId);
  }

  /** Place in line, or -1 when not in it. */
  place(spot: string, agentId: string) {
    return this.lines.get(spot)?.indexOf(agentId) ?? -1;
  }

  leave(spot: string, agentId: string) {
    const line = this.lines.get(spot);
    if (!line) return;
    const next = line.filter((id) => id !== agentId);
    if (next.length) this.lines.set(spot, next);
    else this.lines.delete(spot);
  }

  /** Leave every line (agent removed or scene skipped). */
  leaveAll(agentId: string) {
    for (const spot of [...this.lines.keys()]) this.leave(spot, agentId);
  }

  clear() {
    this.lines.clear();
  }
}
