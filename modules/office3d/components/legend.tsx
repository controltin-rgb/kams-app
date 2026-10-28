"use client";

import type { AssetStatus } from "@/generated/prisma/enums";
import { assetStatusLabels, ticketPriorityLabels } from "@/lib/labels";
import { assetStatusColors, priorityColors } from "../scene";

const statuses: AssetStatus[] = ["IN_USE", "IN_MAINTENANCE", "CLAIMING", "SPARE", "PENDING_DISPOSAL"];

function Dot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

/** What the status lights and markers mean */
export function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[calc(100%-1.5rem)] rounded-2xl bg-card/90 px-4 py-3 text-xs shadow-sm backdrop-blur sm:block">
      <p className="mb-1.5 font-semibold">ไฟสถานะครุภัณฑ์</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {statuses.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <Dot color={assetStatusColors[s]} /> {assetStatusLabels[s]}
          </li>
        ))}
      </ul>
      <p className="mb-1.5 mt-2.5 font-semibold">ป้ายแจ้งซ่อม (ตามความเร่งด่วน)</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
          <li key={p} className="flex items-center gap-1.5">
            <Dot color={priorityColors[p]} /> {ticketPriorityLabels[p]}
          </li>
        ))}
      </ul>
    </div>
  );
}
