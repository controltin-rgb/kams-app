import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { scheduleFormOptions } from "@/modules/pm/queries";
import { ScheduleForm } from "../schedule-form";

export const metadata: Metadata = { title: "สร้างแผน PM | AMS" };

export default async function NewSchedulePage() {
  await requirePermission("pm", "create");
  const options = await scheduleFormOptions();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader icon={Plus} tone="teal" title="สร้างแผน PM" description="ระบบสร้างงาน PM ล่วงหน้าตามความถี่ให้อัตโนมัติ" />
      <ScheduleForm options={options} />
    </div>
  );
}
