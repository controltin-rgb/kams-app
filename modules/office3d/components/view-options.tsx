"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Gauge, Monitor, X } from "lucide-react";
import { office3dQualityLabels } from "@/lib/labels";

export type Quality = keyof typeof office3dQualityLabels;
const QUALITIES = Object.keys(office3dQualityLabels) as Quality[];
const STORAGE_KEY = "office3d.quality";

function storedQuality(): Quality {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && (QUALITIES as string[]).includes(v) ? (v as Quality) : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Quality preset (IMPLEMENTATION.md §8 3D-5): Low = no shadow pass, pixel ratio 1. Auto follows drei's
 * PerformanceMonitor (`setStruggling`). The choice is remembered per browser.
 */
export function useQuality() {
  const [quality, setQualityState] = useState<Quality>(storedQuality);
  const [struggling, setStruggling] = useState(false);
  const setQuality = useCallback((q: Quality) => {
    setQualityState(q);
    try {
      window.localStorage.setItem(STORAGE_KEY, q);
    } catch {
      // private mode: keep it for this visit only
    }
  }, []);
  const low = quality === "low" || (quality === "auto" && struggling);
  return { quality, setQuality, low, setStruggling };
}

export function QualityButton({ quality, onChange }: { quality: Quality; onChange: (q: Quality) => void }) {
  const next = QUALITIES[(QUALITIES.indexOf(quality) + 1) % QUALITIES.length];
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={`คุณภาพการแสดงผล: ${office3dQualityLabels[quality]} (กดเพื่อเปลี่ยน)`}
      title="คุณภาพการแสดงผล"
      className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-muted"
    >
      <Gauge className="size-4" /> {office3dQualityLabels[quality]}
    </button>
  );
}

/**
 * Kiosk mode (§8 3D-5): the office fills the screen without the app around it or the controls, for a wall display.
 * Starts with `?kiosk`; entered from the button it also asks the browser for fullscreen. Esc leaves.
 */
export function useKiosk(root: RefObject<HTMLElement | null>) {
  const [kiosk, setKiosk] = useState(() => new URLSearchParams(window.location.search).has("kiosk"));
  const viaFullscreen = useRef(false);

  const enter = useCallback(() => {
    setKiosk(true);
    const el = root.current;
    if (el?.requestFullscreen) {
      el.requestFullscreen()
        .then(() => void (viaFullscreen.current = true))
        .catch(() => {});
    }
  }, [root]);
  const exit = useCallback(() => {
    setKiosk(false);
    viaFullscreen.current = false;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!kiosk) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exit();
    // Leaving browser fullscreen (Esc is taken by the browser there) leaves kiosk too
    const onFullscreen = () => !document.fullscreenElement && viaFullscreen.current && exit();
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [kiosk, exit]);

  return { kiosk, enter, exit };
}

export function KioskButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="โหมดจอแสดงผล"
      title="โหมดจอแสดงผล (เต็มจอ)"
      className="rounded-full bg-card p-2.5 shadow-sm transition hover:bg-muted"
    >
      <Monitor className="size-4" />
    </button>
  );
}

/** The only control in kiosk mode, faint until pointed at */
export function KioskExit({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="ออกจากโหมดจอแสดงผล"
      className="absolute right-3 top-3 rounded-full bg-card p-2.5 opacity-40 shadow-sm transition hover:opacity-100 focus-visible:opacity-100"
    >
      <X className="size-4" />
    </button>
  );
}
