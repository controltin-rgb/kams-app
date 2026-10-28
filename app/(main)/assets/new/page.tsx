import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { createAsset } from "@/modules/assets/actions";
import { getAssetFormOptions } from "@/modules/assets/queries";
import { AssetForm } from "../asset-form";

export const metadata: Metadata = { title: "ลงทะเบียนครุภัณฑ์ | AMS" };

export default async function NewAssetPage() {
  await requirePermission("asset", "create");
  const options = await getAssetFormOptions();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader icon={Plus} tone="orange" title="ลงทะเบียนครุภัณฑ์" description="รหัสครุภัณฑ์จะถูกสร้างอัตโนมัติตามประเภทและปี" />
      <AssetForm mode="create" action={createAsset} options={options} cancelHref="/assets" />
    </div>
  );
}
