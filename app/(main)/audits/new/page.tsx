import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { campaignFormOptions } from "@/modules/audits/queries";
import { CampaignForm } from "../campaign-form";

export const metadata: Metadata = { title: "สร้างรอบตรวจนับ | AMS" };

export default async function NewCampaignPage() {
  await requirePermission("audit", "create");
  const options = await campaignFormOptions();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader icon={ClipboardCheck} tone="violet" title="สร้างรอบตรวจนับ" description="กำหนดสถานที่และผู้ตรวจนับ ครุภัณฑ์ในสถานที่ย่อยจะถูกนับรวมด้วย" />
      <CampaignForm options={options} />
    </div>
  );
}
