import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { campaignFormOptions } from "@/modules/audits/queries";
import { CampaignForm } from "../../campaign-form";

export const metadata: Metadata = { title: "แก้ไขรอบตรวจนับ | AMS" };

export default async function EditCampaignPage({ params }: PageProps<"/audits/[id]/edit">) {
  await requirePermission("audit", "update");
  const { id } = await params;
  const [c, options] = await Promise.all([prisma.auditCampaign.findUnique({ where: { id }, include: { auditors: true } }), campaignFormOptions()]);
  if (!c || c.status === "CLOSED") notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader icon={ClipboardCheck} tone="violet" title="แก้ไขรอบตรวจนับ" description={c.title} />
      <CampaignForm
        options={options}
        scopeLocked={c.status !== "DRAFT"}
        defaults={{
          id: c.id,
          title: c.title,
          year: c.year,
          startDate: c.startDate.toISOString().slice(0, 10),
          endDate: c.endDate.toISOString().slice(0, 10),
          note: c.note,
          scopeLocationIds: c.scopeLocationIds,
          auditorIds: c.auditors.map((a) => a.userId),
        }}
      />
    </div>
  );
}
