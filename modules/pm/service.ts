import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addPeriod, bangkokToday } from "./dates";

export { addPeriod, bangkokToday };

const MAX_RUNS_PER_SCHEDULE = 60; // safety stop for very old start dates

/**
 * Create PM runs due within the lead window and mark missed runs as OVERDUE.
 * Idempotent: (scheduleId, dueDate) is unique and nextDueDate advances in the same transaction.
 */
export async function generatePmRuns(now = new Date()) {
  const today = bangkokToday(now);
  const leadDays = (await getSettings())["pm.leadDays"];
  const horizon = new Date(today.getTime() + leadDays * 86_400_000);

  const schedules = await prisma.pmSchedule.findMany({ where: { active: true, nextDueDate: { lte: horizon } } });
  let created = 0;
  for (const s of schedules) {
    await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction with a row lock so concurrent callers do not double-advance
      const rows = await tx.$queryRaw<{ nextDueDate: Date }[]>`SELECT "nextDueDate" FROM "PmSchedule" WHERE id = ${s.id} FOR UPDATE`;
      let next = rows[0]?.nextDueDate;
      if (!next) return;
      let guard = 0;
      while (next <= horizon && guard++ < MAX_RUNS_PER_SCHEDULE) {
        const r = await tx.pmRun.createMany({ data: [{ scheduleId: s.id, dueDate: next }], skipDuplicates: true });
        created += r.count;
        next = addPeriod(next, s.frequency);
      }
      await tx.pmSchedule.update({ where: { id: s.id }, data: { nextDueDate: next } });
    });
  }

  const overdue = await prisma.pmRun.updateMany({ where: { status: "SCHEDULED", dueDate: { lt: today } }, data: { status: "OVERDUE" } });
  return { created, overdue: overdue.count };
}
