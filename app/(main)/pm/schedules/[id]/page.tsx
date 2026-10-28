import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { getSchedule, scheduleFormOptions } from "@/modules/pm/queries";
import { ScheduleForm } from "../schedule-form";

export const metadata: Metadata = { title: "แก้ไขแผน PM | AMS" };

export default async function EditSchedulePage({ params }: PageProps<"/pm/schedules/[id]">) {
  await requirePermission("pm", "update");
  const { id } = await params;
  const [schedule, options] = await Promise.all([getSchedule(id), scheduleFormOptions()]);
  if (!schedule) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader icon={Pencil} tone="teal" title="แก้ไขแผน PM" description="เปลี่ยนความถี่หรือวันเริ่ม จะวางแผนรอบที่ยังไม่ถึงกำหนดใหม่" />
      <ScheduleForm options={options} schedule={schedule} />
    </div>
  );
}
