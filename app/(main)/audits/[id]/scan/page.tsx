import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { canScanCampaign } from "@/modules/audits/service";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "สแกนตรวจนับ | AMS" };

/** Mobile-first scan page. Works offline after the first visit (service worker + IndexedDB queue). */
export default async function ScanPage({ params }: PageProps<"/audits/[id]/scan">) {
  const session = await requirePermission("audit", "scan");
  const { id } = await params;
  if (!(await canScanCampaign({ id: session.user.id, role: session.user.role }, id))) forbidden();
  return <Scanner campaignId={id} />;
}
