import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { office3dModelLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { crudFlags } from "@/lib/permissions-server";
import { requirePermission } from "@/lib/session";
import { listLocations } from "@/modules/master/queries";
import { getActiveLayout } from "@/modules/office3d/layout";
import { slotOptions } from "@/modules/office3d/scene";
import { LocationsTable } from "./locations-table";

export const metadata: Metadata = { title: "สถานที่ | AMS" };

/** e.g. "โต๊ะพนักงาน 03 · จอภาพ, คีย์บอร์ด, เมาส์, คอมพิวเตอร์ (เคส)" */
async function sceneSlotOptions() {
  const label = (m: string) => office3dModelLabels[m] ?? m;
  return slotOptions((await getActiveLayout()).config.items).map((s) => {
    const [model, n] = [s.id.slice(0, s.id.lastIndexOf("-")), s.id.slice(s.id.lastIndexOf("-") + 1)];
    return { value: s.id, label: `${label(model)} ${n} · ${s.models.map(label).join(", ")}` };
  });
}

export default async function LocationsPage() {
  const session = await requirePermission("masterData", "view");
  const rows = await listLocations();
  const sceneSlots = can(session.user.role, "office3d", "configureLayout") ? await sceneSlotOptions() : undefined;

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader icon={MapPin} tone="pink" title="สถานที่" description="โครงสร้าง อาคาร → ชั้น → ห้อง → จุด" />
      <Panel>
        <LocationsTable rows={rows} can={crudFlags(session.user.role, "masterData")} sceneSlots={sceneSlots} />
      </Panel>
    </div>
  );
}
