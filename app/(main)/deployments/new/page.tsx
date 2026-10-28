import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { deploymentOptions } from "@/modules/deployments/queries";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "ส่งมอบ / คืน / ย้าย | AMS" };

/** `?asset=<id>&type=HANDOVER|RETURN|MOVE` preselects from the asset page. */
export default async function NewTransferPage({ searchParams }: PageProps<"/deployments/new">) {
  await requirePermission("deployment", "create");
  const { asset, type } = await searchParams;
  const options = await deploymentOptions();
  const defaultAssetIds = typeof asset === "string" && options.rootAssets.some((a) => a.value === asset) ? [asset] : [];
  const defaultType = type === "RETURN" || type === "MOVE" ? type : "HANDOVER";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader icon={PackageCheck} tone="green" title="ส่งมอบ / คืน / ย้าย" description="ออกเอกสารพร้อมลายเซ็นผู้รับ ระบบบันทึกประวัติครุภัณฑ์ให้อัตโนมัติ" />
      <TransferForm options={options} defaultAssetIds={defaultAssetIds} defaultType={defaultType} />
    </div>
  );
}
