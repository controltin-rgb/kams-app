import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { claimFormOptions } from "@/modules/claims/queries";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "ส่งเคลม | AMS" };

/** `?asset=<id>` or `?ticket=<id>` preselects from the asset / ticket page. */
export default async function NewClaimPage({ searchParams }: PageProps<"/claims/new">) {
  await requirePermission("claim", "create");
  const { asset, ticket } = await searchParams;
  const options = await claimFormOptions();
  const t = typeof ticket === "string" ? await prisma.ticket.findUnique({ where: { id: ticket }, select: { id: true, assetId: true, title: true, description: true } }) : null;
  const assetId = typeof asset === "string" ? asset : (t?.assetId ?? undefined);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader icon={Wrench} tone="blue" title="ส่งเคลม / ส่งซ่อมภายนอก" description="ออกใบส่งเคลมให้ผู้ขายหรือศูนย์บริการ" />
      <ClaimForm
        options={options}
        defaults={{
          assetId: assetId && options.assets.some((a) => a.value === assetId) ? assetId : undefined,
          ticketId: t?.id,
          problem: t ? [t.title, t.description].filter(Boolean).join("\n") : undefined,
        }}
      />
    </div>
  );
}
