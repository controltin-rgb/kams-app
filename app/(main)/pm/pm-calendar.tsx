import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pmRunStatusTone } from "@/lib/labels";
import type { RunRow } from "@/modules/pm/queries";

const weekdays = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Month grid (Monday first) with PM runs per day. `month` = YYYY-MM, `today` = YYYY-MM-DD (Asia/Bangkok). */
export function PmCalendar({ month, today, runs }: { month: string; today: string; runs: RunRow[] }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const byDay = new Map<number, RunRow[]>();
  for (const r of runs) {
    const day = Number(r.dueDate.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }
  const title = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-1">
          <Button asChild variant="outline" size="icon-lg" aria-label="เดือนก่อน">
            <Link href={`/pm?month=${shift(month, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-9 rounded-lg">
            <Link href="/pm">วันนี้</Link>
          </Button>
          <Button asChild variant="outline" size="icon-lg" aria-label="เดือนถัดไป">
            <Link href={`/pm?month=${shift(month, 1)}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-border text-sm">
        {weekdays.map((d) => (
          <div key={d} className="border-b border-border bg-muted/50 py-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const iso = day ? `${month}-${String(day).padStart(2, "0")}` : "";
          const items = day ? (byDay.get(day) ?? []) : [];
          return (
            <div key={i} className={`min-h-24 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0 ${day ? "" : "bg-muted/20"}`}>
              {day && (
                <>
                  <div className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs ${iso === today ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground"}`}>
                    {day}
                  </div>
                  <ul className="space-y-1">
                    {items.slice(0, 3).map((r) => (
                      <li key={r.id}>
                        <Link href={`/pm/runs/${r.id}`} title={`${r.title} · ${r.target}`} className={`block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80 ${pmRunStatusTone[r.status]}`}>
                          {r.title}
                        </Link>
                      </li>
                    ))}
                    {items.length > 3 && <li className="px-1.5 text-[11px] text-muted-foreground">+{items.length - 3} รายการ</li>}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
