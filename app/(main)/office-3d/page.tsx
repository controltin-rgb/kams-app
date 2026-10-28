import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Box } from "lucide-react";
import { GradientIcon } from "@/components/gradient-icon";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { buildSnapshot } from "@/modules/office3d/snapshot";
import { Office3DView } from "./office-3d-view";

export const metadata: Metadata = { title: "3D Office | AMS" };

export default async function Office3DPage() {
  const session = await requirePermission("office3d", "view");
  const snapshot = await buildSnapshot({ id: session.user.id, role: session.user.role });

  return (
    <div className="w-full space-y-6">
      <div className="flex animate-fade-up flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <GradientIcon icon={Box} tone="violet" className="size-14 rounded-2xl sm:size-19 sm:rounded-3xl" iconClass="size-7 sm:size-9" />
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">3D Office</h1>
            <p className="mt-1 text-muted-foreground">มุมมองสำนักงานแบบ 3 มิติ</p>
          </div>
        </div>
        <Link href="/dashboard" className="flex items-center gap-2 rounded-full bg-card px-5 py-3.5 font-semibold shadow-sm transition hover:bg-muted">
          <ArrowLeft className="size-4" /> กลับ Dashboard
        </Link>
      </div>
      <section className="relative h-[calc(100dvh-13rem)] min-h-[420px] animate-fade-up overflow-hidden rounded-[28px] bg-[#f6f1ec] shadow-sm shadow-black/4 dark:bg-[#2a2622]">
        <Office3DView snapshot={snapshot} canEditLayout={can(session.user.role, "office3d", "configureLayout")} />
      </section>
    </div>
  );
}
