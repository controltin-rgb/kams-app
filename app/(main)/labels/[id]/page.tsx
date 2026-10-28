import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getTemplate } from "@/modules/labels/queries";
import { LabelEditor } from "./label-editor";

export const metadata: Metadata = { title: "ออกแบบฉลาก | AMS" };

export default async function LabelEditorPage({ params }: PageProps<"/labels/[id]">) {
  const session = await requirePermission("label", "view");
  const { id } = await params;
  const [template, settings] = await Promise.all([getTemplate(id), getSettings()]);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-400">
      <LabelEditor template={template} orgName={settings["org.name"]} canEdit={can(session.user.role, "label", "update")} />
    </div>
  );
}
