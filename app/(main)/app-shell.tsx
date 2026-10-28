"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Blocks, ChevronDown, Menu } from "lucide-react";
import { GradientIcon } from "@/components/gradient-icon";
import { Button } from "@/components/ui/button";
import { activeHref, navigationFor, pageTitle, type NavGroup } from "@/lib/navigation";
import { setRolePermissions, type PermissionMap } from "@/lib/permissions";
import { HeaderMenus, type HeaderUser } from "./header-menus";
import { ImpersonationBar } from "./impersonation-bar";

function SoonBadge() {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">เร็วๆ นี้</span>;
}

function Sidebar({ items, onNavigate }: { items: NavGroup[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const current = activeHref(pathname);
  const [open, setOpen] = useState<string | null>(
    () => items.find((g) => g.children?.some((c) => c.href === current))?.label ?? null,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 pb-4 pt-8">
        <GradientIcon icon={Blocks} tone="orange" className="size-15 rounded-2xl" iconClass="size-7" />
        <div className="leading-tight">
          <div className="text-[19px] font-semibold">Assets Management System</div>
          <div className="mt-1 text-xs text-muted-foreground">องค์กรของคุณ</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {items.map((item, i) => {
          const active = !!item.href && item.href === current;
          const expanded = open === item.label;
          const base = `flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
            active ? "bg-brand/15 font-semibold" : item.soon ? "cursor-default opacity-60" : "hover:bg-muted"
          }`;
          const content = (
            <>
              <GradientIcon icon={item.icon} tone={item.tone} className="size-10 rounded-xl" />
              <span className={`flex-1 ${item.children ? "font-semibold" : ""}`}>{item.label}</span>
              {item.soon && <SoonBadge />}
              {item.children && (
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
              )}
            </>
          );
          return (
            <div key={item.label} className="animate-slide-in" style={{ animationDelay: `${i * 30}ms` }}>
              {item.children ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : item.label)}
                  className={base}
                >
                  {content}
                </button>
              ) : item.href && !item.soon ? (
                <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={base}>
                  {content}
                </Link>
              ) : (
                <div aria-disabled className={base}>
                  {content}
                </div>
              )}
              {expanded && (
                <ul className="ml-8.5 mt-1 animate-drop space-y-1 border-l border-border pl-4">
                  {item.children?.map((c) => (
                    <li key={c.href}>
                      {c.soon ? (
                        <span className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/50">
                          {c.label} <SoonBadge />
                        </span>
                      ) : (
                        <Link
                          href={c.href}
                          onClick={onNavigate}
                          className={`block rounded-lg px-3 py-2 text-sm hover:bg-muted ${
                            c.href === current ? "font-semibold text-brand" : "text-foreground/70"
                          }`}
                        >
                          {c.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border px-6 py-5 text-center text-xs text-muted-foreground">
        พัฒนาโดย <b className="text-foreground/70">Tinnakorn Siripong</b>
        <div className="mt-1">Version 1.3.0</div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user,
  permissions,
  impersonator,
}: {
  children: ReactNode;
  user: HeaderUser;
  permissions: Record<string, PermissionMap>;
  impersonator?: string | null;
}) {
  // Client-side can() (menus, buttons) uses the permissions loaded by the server for this user
  setRolePermissions(permissions);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const items = navigationFor(user.role);

  const toggle = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setDesktopOpen((o) => !o);
    else setMobileOpen((o) => !o);
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div
      className={`min-h-screen bg-background transition-[padding] duration-300 print:bg-card print:pl-0! ${desktopOpen ? "lg:pl-93.75" : "lg:pl-0"}`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-93.75 print:hidden max-w-[85vw] border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopOpen ? "lg:translate-x-0" : "lg:-translate-x-full"}`}
      >
        <Sidebar items={items} onNavigate={() => setMobileOpen(false)} />
      </aside>
      {mobileOpen && (
        <button
          aria-label="ปิดเมนู"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 animate-fade-in print:hidden bg-black/30 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <div className="sticky top-0 z-20 print:hidden">
        {impersonator && <ImpersonationBar userName={user.name} impersonator={impersonator} />}
        <header className="flex print:hidden h-18 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:h-22 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <Button
              variant="outline"
              size="icon"
              onClick={toggle}
              aria-label="เปิด/ปิดเมนู"
              aria-expanded={mobileOpen || desktopOpen}
              className="size-11 shrink-0 rounded-xl"
            >
              <Menu className="size-4" />
            </Button>
            <span className="truncate text-lg text-foreground/80">{pageTitle(pathname)}</span>
          </div>
          <HeaderMenus user={user} />
        </header>
      </div>

      <main className="p-4 sm:p-6 print:p-0">{children}</main>
    </div>
  );
}
