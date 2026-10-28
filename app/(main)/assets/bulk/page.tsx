import type { Metadata } from "next";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { bulkCreateAssets } from "@/modules/assets/actions";
import { getAssetFormOptions } from "@/modules/assets/queries";
import { AssetForm } from "../asset-form";

export const metadata: Metadata = { title: "เพิ่มครุภัณฑ์หลายรายการ | AMS" };

export default async function BulkAssetPage() {
  await requirePermission("asset", "create");
  const options = await getAssetFormOptions();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Layers}
        tone="orange"
        title="เพิ่มครุภัณฑ์หลายรายการ"
        description="สร้างครุภัณฑ์สเปกเดียวกันครั้งละไม่เกิน 100 รายการ ระบบออกรหัสต่อเนื่องให้"
      />
      <AssetForm mode="bulk" action={bulkCreateAssets} options={options} cancelHref="/assets" />
    </div>
  );
}
