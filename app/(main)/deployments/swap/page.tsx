import type { Metadata } from "next";
import { Repeat } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { bundleChildren, deploymentOptions } from "@/modules/deployments/queries";
import { SwapForms } from "./swap-form";

export const metadata: Metadata = { title: "เปลี่ยนเครื่อง (Swap) | AMS" };

/** `?mode=partial|full&asset=<id>` preselects from the asset page. */
export default async function SwapPage({ searchParams }: PageProps<"/deployments/swap">) {
  await requirePermission("deployment", "swap");
  const { mode, asset } = await searchParams;
  const options = await deploymentOptions();
  const children = await bundleChildren(options.bundles.map((b) => b.value));
  const defaultMode = mode === "full" ? "full" : "partial";
  const defaultParent = typeof asset === "string" ? asset : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader icon={Repeat} tone="violet" title="เปลี่ยนเครื่อง (Swap)" description="ออกใบเปลี่ยนเครื่อง บันทึกประวัติทั้งชิ้นเก่าและชิ้นใหม่" />
      <SwapForms options={options} bundleChildren={children} defaultMode={defaultMode} defaultParent={defaultParent} />
    </div>
  );
}
