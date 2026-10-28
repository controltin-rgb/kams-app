import type { Metadata } from "next";
import { Headset } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { assetOptionsFor } from "@/modules/tickets/queries";
import { TicketForm } from "./ticket-form";

export const metadata: Metadata = { title: "แจ้งซ่อม | AMS" };

/** `?asset=<assetCode>` preselects the asset (used by the QR scan page). */
export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  const session = await requirePermission("ticket", "create");
  const { asset: assetCode } = await searchParams;
  const [assets, settings] = await Promise.all([assetOptionsFor({ id: session.user.id, role: session.user.role }), getSettings()]);

  // A scanned asset is preselected even if it is not in the user's own list (e.g. a shared printer)
  let defaultAssetId: string | undefined;
  if (typeof assetCode === "string") {
    const asset = await prisma.asset.findFirst({ where: { assetCode, deletedAt: null }, select: { id: true, assetCode: true, name: true } });
    if (asset) {
      defaultAssetId = asset.id;
      if (!assets.some((a) => a.value === asset.id)) assets.unshift({ value: asset.id, label: `${asset.assetCode} ${asset.name}` });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader icon={Headset} tone="pink" title="แจ้งซ่อม" description="แจ้งปัญหาการใช้งานครุภัณฑ์ อาคาร หรืองานทั่วไป" />
      <TicketForm assets={assets} defaultAssetId={defaultAssetId} fromQr={typeof assetCode === "string"} sla={settings["ticket.slaHours"]} />
    </div>
  );
}
