const thMonthLong = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", month: "long", year: "numeric" });
const BKK = 7 * 3600_000;

/** First instant of a Bangkok month. `month` may be outside 1..12 (e.g. -5 = "11 months before June"). */
export function monthStart(year: number, month: number) {
  const idx = year * 12 + month - 1;
  return new Date(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01T00:00:00+07:00`);
}

/** "YYYY-MM" (Bangkok) → UTC range. Invalid or future months fall back to the current month. */
export function monthRange(month?: string, now = Date.now()) {
  const current = new Date(now + BKK).toISOString().slice(0, 7);
  const m = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= current ? month : current;
  const [y, mo] = m.split("-").map(Number);
  const gte = monthStart(y, mo);
  return { month: m, year: y, monthNo: mo, gte, lt: monthStart(y, mo + 1), label: thMonthLong.format(gte), isCurrent: m === current };
}
export type MonthRange = ReturnType<typeof monthRange>;
