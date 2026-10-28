import type { PmFrequency } from "@/generated/prisma/enums";

// Pure date helpers for PM scheduling (unit tested). Dates are UTC-midnight values matching @db.Date columns.

/** Today's date in Asia/Bangkok as a UTC-midnight Date (matches @db.Date columns). */
export function bangkokToday(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function addPeriod(date: Date, frequency: PmFrequency) {
  const d = new Date(date);
  if (frequency === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const months = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : 12;
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    // Clamp to the last day of the month (e.g. 31 Jan → 28/29 Feb)
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d;
}

/** First occurrence of a schedule on or after `today` (no backlog for past start dates). */
export function firstOccurrence(start: Date, frequency: PmFrequency, today: Date) {
  let d = start;
  let guard = 0;
  while (d < today && guard++ < 1000) d = addPeriod(d, frequency);
  return d;
}
