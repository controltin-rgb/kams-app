import type { Metadata } from "next";
import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { getAssetFormOptions } from "@/modules/assets/queries";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "นำเข้าครุภัณฑ์ | AMS" };

export default async function ImportAssetsPage() {
  await requirePermission("asset", "import");
  const { categories } = await getAssetFormOptions();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader icon={FileUp} tone="orange" title="นำเข้าครุภัณฑ์" description="นำเข้าจาก Excel หรือ CSV ตรวจสอบทุกแถวก่อนบันทึก" />
      <ImportWizard categories={categories} />
    </div>
  );
}
