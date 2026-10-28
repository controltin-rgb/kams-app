"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  Bell,
  CalendarCheck,
  CheckCheck,
  ChevronDown,
  DatabaseBackup,
  Headset,
  KeyRound,
  LogOut,
  ShieldAlert,
  Truck,
  User,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { GradientIcon, type Tone } from "@/components/gradient-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { markAllNotificationsRead, markNotificationRead, myNotifications, type MyNotifications } from "@/modules/notifications/actions";

const eventIcon: Record<string, { icon: LucideIcon; tone: Tone }> = {
  TICKET_CREATED: { icon: Headset, tone: "pink" },
  TICKET_ASSIGNED: { icon: UserCheck, tone: "violet" },
  TICKET_STATUS: { icon: Wrench, tone: "orange" },
  TICKET_SLA_OVERDUE: { icon: AlarmClock, tone: "red" },
  PM_DUE: { icon: CalendarCheck, tone: "teal" },
  PM_OVERDUE: { icon: CalendarCheck, tone: "red" },
  CLAIM_OVERDUE: { icon: Truck, tone: "blue" },
  WARRANTY_EXPIRING: { icon: ShieldAlert, tone: "red" },
  BACKUP_FAILED: { icon: DatabaseBackup, tone: "red" },
};
const fallbackIcon = { icon: Bell, tone: "blue" as Tone };

const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
function ago(iso: string, now: number) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  if (s > -60) return "เมื่อสักครู่";
  if (s > -3600) return rtf.format(Math.round(s / 60), "minute");
  if (s > -86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

const profileItems: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: User, label: "Profile", href: "/profile" },
  { icon: KeyRound, label: "เปลี่ยนรหัสผ่าน", href: "/profile#password" },
];

const menuContent = "rounded-2xl border border-border p-0 shadow-2xl shadow-black/15 dark:shadow-black/40";

export type HeaderUser = { name: string; role: string; roleLabel: string };

export function HeaderMenus({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const [data, setData] = useState<MyNotifications & { now: number }>({ unread: 0, items: [], now: 0 });
  const unread = data.unread;

  // Layouts are not re-rendered on client navigation, so the bell polls
  const load = useCallback(
    () =>
      myNotifications()
        .then((next) => setData({ ...next, now: Date.now() }))
        // signed out or offline; keep what is shown
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const open = async (id: string, href: string | null) => {
    await markNotificationRead(id);
    if (href) router.push(href);
    void load();
  };

  const signOut = async () => {
    await authClient.signOut();
    router.replace("/auth");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <ThemeToggle />

      <DropdownMenu onOpenChange={(o) => o && void load()}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={unread ? `การแจ้งเตือน (ยังไม่อ่าน ${unread})` : "การแจ้งเตือน"} className="relative size-11 rounded-full aria-expanded:bg-accent">
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-pink-500 text-[11px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} collisionPadding={16} className={`w-[min(400px,calc(100vw-2rem))] ${menuContent}`}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DropdownMenuLabel className="p-0 text-base font-semibold text-foreground">การแจ้งเตือน</DropdownMenuLabel>
            <button
              type="button"
              disabled={!unread}
              onClick={async () => {
                await markAllNotificationsRead();
                void load();
              }}
              className="flex items-center gap-1 text-sm text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              <CheckCheck className="size-4" /> อ่านทั้งหมด
            </button>
          </div>
          <DropdownMenuGroup className="max-h-105 divide-y divide-border overflow-y-auto">
            {data.items.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>}
            {data.items.map((n) => {
              const { icon, tone } = eventIcon[n.event] ?? fallbackIcon;
              const isUnread = !n.readAt;
              return (
                <DropdownMenuItem key={n.id} onSelect={() => void open(n.id, n.href)} className={`items-start gap-3 rounded-none px-5 py-4 ${isUnread ? "bg-primary/5" : ""}`}>
                  <GradientIcon icon={icon} tone={tone} className="size-10 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {n.title}
                      {isUnread && <span className="size-2 shrink-0 rounded-full bg-pink-500" />}
                    </span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-foreground/70">{n.body}</span>}
                    <span className="mt-1 block text-xs text-muted-foreground">{ago(n.createdAt, data.now)}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="m-0" />
          <DropdownMenuItem asChild className="justify-center rounded-none py-3 text-sm font-semibold text-primary">
            <Link href="/notifications">ดูทั้งหมด</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex items-center gap-3 rounded-full border border-border bg-card py-2 pl-2 pr-4 shadow-sm transition outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {user.name.charAt(0)}
            </span>
            <span className="hidden text-left text-sm leading-tight sm:block">
              <b className="block">{user.name}</b>
              <span className="text-muted-foreground">{user.roleLabel}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} collisionPadding={16} className={`w-64 p-2 ${menuContent}`}>
          {profileItems.map(({ icon: Icon, label, href }) => (
            <DropdownMenuItem key={href} asChild className="gap-3 rounded-xl px-3 py-2.5">
              <Link href={href}>
                <Icon className="size-4 text-muted-foreground" /> {label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem variant="destructive" onSelect={() => void signOut()} className="gap-3 rounded-xl px-3 py-2.5">
            <LogOut className="size-4" /> ออกจากระบบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
