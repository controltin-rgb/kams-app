// Dates are stored in UTC (ค.ศ.) and always displayed in Asia/Bangkok with the Buddhist calendar (พ.ศ.).
const TZ = "Asia/Bangkok";

const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. "26 ต.ค. 2569" */
export function formatDate(value: DateInput, fallback = "-") {
  const d = toDate(value);
  return d ? dateFmt.format(d) : fallback;
}

/** e.g. "26 ต.ค. 2569 13:05" */
export function formatDateTime(value: DateInput, fallback = "-") {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : fallback;
}

const timeFmt = new Intl.DateTimeFormat("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** e.g. "13:05:42" (Asia/Bangkok) */
export function formatTime(value: DateInput, fallback = "-") {
  const d = toDate(value);
  return d ? timeFmt.format(d) : fallback;
}
