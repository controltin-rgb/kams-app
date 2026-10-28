"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Box, CalendarDays, RefreshCw } from "lucide-react";

export function MonthPicker({ month, max, office3d }: { month: string; max: string; office3d: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-3 rounded-full bg-card px-5 py-2.5 shadow-sm">
        <CalendarDays className="size-5" />
        <span className="font-semibold">เลือกเดือน</span>
        <input
          type="month"
          value={month}
          max={max}
          aria-label="เดือน"
          onChange={(e) => e.target.value && start(() => router.push(`${pathname}?month=${e.target.value}`))}
          className="rounded-lg bg-orange-50 px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand/30 dark:bg-orange-500/15"
        />
      </label>
      <button
        type="button"
        onClick={() => start(() => router.refresh())}
        disabled={pending}
        className="group flex items-center gap-2 rounded-full bg-card px-5 py-3.5 font-semibold shadow-sm transition hover:bg-muted disabled:opacity-60"
      >
        <RefreshCw className={`size-4 transition-transform duration-500 group-hover:rotate-180 ${pending ? "animate-spin" : ""}`} /> รีเฟรช
      </button>
      {office3d && (
        <Link href="/office-3d" className="flex items-center gap-2 rounded-full bg-card px-5 py-3.5 font-semibold shadow-sm transition hover:bg-muted">
          <Box className="size-4" /> 3D Office
        </Link>
      )}
    </div>
  );
}
