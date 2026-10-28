import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { NotificationsTable } from "./notifications-table";

export const metadata: Metadata = { title: "การแจ้งเตือน | AMS" };

export default async function NotificationsPage() {
  const session = await requireSession();
  const rows = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, event: true, title: true, body: true, href: true, readAt: true, createdAt: true },
  });
  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader icon={Bell} tone="pink" title="การแจ้งเตือน" description={`ยังไม่อ่าน ${unread} รายการ (แสดง 500 รายการล่าสุด)`} />
      <Panel>
        <NotificationsTable
          rows={rows.map((r) => ({ ...r, body: r.body ?? "", href: r.href ?? "", status: r.readAt ? "read" : "unread", createdAt: r.createdAt.toISOString(), readAt: r.readAt?.toISOString() ?? null }))}
          hasUnread={unread > 0}
        />
      </Panel>
    </div>
  );
}
