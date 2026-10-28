"use client";

import dynamic from "next/dynamic";
import type { OfficeSnapshot } from "@/modules/office3d/scene";

// three.js / R3F only load on this route, in the browser
const OfficeCanvas = dynamic(() => import("@/modules/office3d/components/office-canvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">กำลังเตรียมฉาก 3 มิติ…</div>,
});

export function Office3DView({ snapshot, canEditLayout }: { snapshot: OfficeSnapshot; canEditLayout: boolean }) {
  return <OfficeCanvas initial={snapshot} canEditLayout={canEditLayout} />;
}
