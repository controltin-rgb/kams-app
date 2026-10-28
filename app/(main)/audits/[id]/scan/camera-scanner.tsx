"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Continuous camera decoding (QR + Code128) with the rear camera.
 * The same code is ignored for a short moment so one label is not recorded many times.
 */
export function CameraScanner({ onCode }: { onCode: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    let last = { text: "", at: 0 };

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current!, (result) => {
          if (!result) return;
          const text = result.getText();
          const now = Date.now();
          if (text === last.text && now - last.at < 2500) return;
          last = { text, at: now };
          navigator.vibrate?.(60);
          onCodeRef.current(text);
        });
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name === "NotAllowedError" ? "ไม่ได้รับอนุญาตให้ใช้กล้อง" : "เปิดกล้องไม่ได้ (ต้องใช้ HTTPS หรือ localhost)");
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
      {error && <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{error}</p>}
    </div>
  );
}
