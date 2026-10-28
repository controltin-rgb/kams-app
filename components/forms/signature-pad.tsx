"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * On-screen signature (mouse / touch / pen). Writes a PNG data URL into a hidden input
 * named `name`, or an empty value when nothing is drawn.
 */
export function SignaturePad({ name = "signature", label = "ลายเซ็นผู้รับ" }: { name?: string; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Match the bitmap to the displayed size for crisp lines
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setValue("");
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <PenLine className="size-4" /> {label}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="rounded-lg text-muted-foreground">
          <Eraser /> ล้าง
        </Button>
      </div>
      {/* White pad in both themes so the saved PNG prints correctly */}
      <canvas
        ref={canvasRef}
        aria-label={label}
        className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-border bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d");
          const p = point(e);
          ctx?.beginPath();
          ctx?.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d");
          const p = point(e);
          ctx?.lineTo(p.x, p.y);
          ctx?.stroke();
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          setValue(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <input type="hidden" name={name} value={value} />
      <p className="text-xs text-muted-foreground">{value ? "ลงนามแล้ว" : "ไม่บังคับ — ลงนามภายหลังได้จากหน้าเอกสาร"}</p>
    </div>
  );
}
