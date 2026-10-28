"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Blocks, LogIn, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const links = [
  { href: "#features", label: "ฟีเจอร์" },
  { href: "#workflow", label: "ขั้นตอนการทำงาน" },
  { href: "#modules", label: "โมดูล" },
  { href: "#office-3d", label: "3D Office" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 12);
      setProgress(max > 0 ? window.scrollY / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open ? "border-b bg-background/80 shadow-sm backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 font-bold">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8a1f] to-[#f0457f] text-white shadow-lg shadow-black/10">
            <Blocks className="size-5" />
          </span>
          <span className="text-lg">AMS</span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="เมนูหลัก">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="size-10" />
          <Button asChild className="hidden h-10 rounded-full px-5 sm:inline-flex">
            <Link href="/auth">
              <LogIn className="size-4" /> เข้าสู่ระบบ
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-10 rounded-full md:hidden"
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="animate-drop border-t px-4 pb-4 pt-2 md:hidden" aria-label="เมนูมือถือ">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-base font-medium hover:bg-accent"
            >
              {l.label}
            </a>
          ))}
          <Button asChild className="mt-2 h-11 w-full rounded-full sm:hidden">
            <Link href="/auth">
              <LogIn className="size-4" /> เข้าสู่ระบบ
            </Link>
          </Button>
        </nav>
      )}

      <div
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-[#ff8a1f] via-[#f0457f] to-[#7c5ce6]"
        style={{ transform: `scaleX(${progress})` }}
      />
    </header>
  );
}
