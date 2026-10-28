import type { Metadata } from "next";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { printableAssets, templatesForPrint } from "@/modules/labels/queries";
import { PrintLabels } from "./print-labels";

export const metadata: Metadata = { title: "พิมพ์ฉลาก | AMS" };

/** `?assets=id1,id2&template=<id>` preselects (e.g. from the asset page). */
export default async function PrintLabelsPage({ searchParams }: PageProps<"/labels/print">) {
  const session = await requirePermission("label", "view");
  const { assets: assetParam, template } = await searchParams;
  const canPrintAssets = can(session.user.role, "asset", "printLabel");
  const [all, assets, settings] = await Promise.all([templatesForPrint(), canPrintAssets ? printableAssets() : Promise.resolve([]), getSettings()]);
  // Users without asset:printLabel can still print status stickers
  const templates = canPrintAssets ? all : all.filter((t) => t.kind === "STATUS");
  const defaultAssetIds = typeof assetParam === "string" ? assetParam.split(",").filter((id) => assets.some((a) => a.value === id)) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="print:hidden">
        <PageHeader icon={Printer} tone="orange" title="พิมพ์ฉลาก" description="พิมพ์เป็นชุด เลือกดวงเริ่มต้นเพื่อใช้กระดาษที่เหลือจากครั้งก่อนได้" />
      </div>
      <PrintLabels
        templates={templates}
        assets={assets}
        orgName={settings["org.name"]}
        defaultAssetIds={defaultAssetIds}
        defaultTemplateId={typeof template === "string" ? template : undefined}
      />
    </div>
  );
}
