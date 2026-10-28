"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { Button } from "@/components/ui/button";
import { notificationEventLabels, notificationStatusLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import { markAllNotificationsRead, markNotificationRead } from "@/modules/notifications/actions";

export type NotificationRow = {
  id: string;
  event: string;
  title: string;
  body: string;
  href: string;
  status: "read" | "unread";
  createdAt: string;
  readAt: string | null;
};

const col = dataTableColumns<NotificationRow>();

const columns = col.columns([
  col.accessor("createdAt", { header: "เวลา", sortFn: "datetime", cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDateTime(getValue())}</span>, meta: { export: (r) => formatDateTime(r.createdAt) } }),
  col.accessor("title", {
    header: "เรื่อง",
    cell: ({ row }) => {
      const r = row.original;
      const text = (
        <span className={r.status === "unread" ? "font-semibold" : ""}>
          {r.status === "unread" && <span className="mr-2 inline-block size-2 rounded-full bg-pink-500" aria-label="ยังไม่อ่าน" />}
          {r.title}
        </span>
      );
      return r.href ? (
        <Link href={r.href} onClick={() => void markNotificationRead(r.id)} className="hover:text-primary hover:underline">
          {text}
        </Link>
      ) : (
        text
      );
    },
  }),
  col.accessor("body", { header: "รายละเอียด", cell: ({ getValue }) => <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">{getValue() || "-"}</span> }),
  col.accessor("event", {
    header: "ประเภท",
    filterFn: "equalsString",
    cell: ({ getValue }) => notificationEventLabels[getValue()] ?? getValue(),
    meta: { export: (r) => notificationEventLabels[r.event] ?? r.event },
  }),
  col.accessor("status", {
    header: "สถานะ",
    filterFn: "equalsString",
    cell: ({ getValue }) => notificationStatusLabels[getValue()],
    meta: { export: (r) => notificationStatusLabels[r.status] },
  }),
]);

const filters: DataTableFilter[] = [
  { columnId: "event", label: "ประเภท", options: Object.entries(notificationEventLabels).map(([value, label]) => ({ value, label })) },
  { columnId: "status", label: "สถานะ", options: Object.entries(notificationStatusLabels).map(([value, label]) => ({ value, label })) },
];

export function NotificationsTable({ rows, hasUnread }: { rows: NotificationRow[]; hasUnread: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <DataTable
      data={rows}
      columns={columns}
      filters={filters}
      pageSizes={[25, 50, 100]}
      exportName="notifications"
      printTitle="การแจ้งเตือน"
      searchPlaceholder="ค้นหาเรื่อง, รายละเอียด..."
      emptyMessage="ยังไม่มีการแจ้งเตือน"
      actions={
        <Button
          variant="outline"
          className="h-10 rounded-xl"
          disabled={!hasUnread || pending}
          onClick={() =>
            start(async () => {
              const r = await markAllNotificationsRead();
              toast.success(r.message);
              router.refresh();
            })
          }
        >
          <CheckCheck /> อ่านทั้งหมด
        </Button>
      }
    />
  );
}
