import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { can, type Resource } from "@/lib/permissions";
import { requireSession } from "@/lib/session";
import { manual } from "@/modules/manual/content";
import { ManualView, PrintButton } from "./manual-view";

export const metadata: Metadata = { title: "การใช้งานระบบ | AMS" };

/** User guide for the whole system (เมนู ระบบ → การใช้งานระบบ), open to everyone signed in. */
export default async function ManualPage() {
  const session = await requireSession();
  const role = session.user.role ?? "user";
  // Sections whose module this person can open (the rest are still readable, marked as needing permission)
  const allowed = manual
    .filter((s) => !s.permission || (can as (role: string, resource: Resource, action: string) => boolean)(role, s.permission.resource, s.permission.action))
    .map((s) => s.id);

  return (
    <div className="w-full space-y-6">
      <PageHeader icon={BookOpen} tone="orange" title="การใช้งานระบบ" description="คู่มือการใช้งานทุกโมดูลของระบบ ตามบทบาทของคุณ" actions={<PrintButton />} />
      <ManualView allowed={allowed} />
    </div>
  );
}
