import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { channelReady } from "@/modules/notifications/service";
import { NotificationSettingsForm } from "./notification-settings";
import { TicketSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "การตั้งค่า | AMS" };

export default async function SettingsPage() {
  await requirePermission("system", "editInfo");
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader icon={Settings} tone="teal" title="การตั้งค่า" description="ค่าที่ใช้ทั้งระบบ" />
      <TicketSettingsForm orgName={settings["org.name"]} sla={settings["ticket.slaHours"]} allowAnonymousQr={settings["ticket.allowAnonymousQr"]} pmLeadDays={settings["pm.leadDays"]} />
      <NotificationSettingsForm globalChannels={settings["notify.channels"]} events={settings["notify.events"]} ready={channelReady()} />
    </div>
  );
}
