"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { fillPlaceholders, type LabelData, type LabelElement } from "@/modules/labels/design";

export type RenderContext = { orgName: string; now: Date; origin: string };

function box(e: LabelElement): CSSProperties {
  return {
    position: "absolute",
    left: `${e.x}mm`,
    top: `${e.y}mm`,
    width: `${e.w}mm`,
    height: `${e.h}mm`,
    transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined,
    transformOrigin: "top left",
  };
}

function Barcode({ value, showText }: { value: string; showText: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !value) return;
    try {
      JsBarcode(svg, value, { format: "CODE128", margin: 0, height: 60, width: 2, displayValue: showText, fontSize: 16, textMargin: 2, background: "transparent" });
      // Stretch to the element box
      const w = svg.getAttribute("width");
      const h = svg.getAttribute("height");
      if (w && h) svg.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
    } catch {
      // invalid characters for Code128 — leave empty
    }
  }, [value, showText]);
  return <svg ref={ref} className="block h-full w-full" aria-label={`บาร์โค้ด ${value}`} />;
}

function Qr({ value }: { value: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((s) => alive && setSvg(s));
    return () => {
      alive = false;
    };
  }, [value]);
  // SVG markup is generated locally by the qrcode library
  return <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** One label rendered in real millimetres. `data` is null for status stickers. */
export function LabelView({
  width,
  height,
  elements,
  data,
  ctx,
  outline = false,
}: {
  width: number;
  height: number;
  elements: LabelElement[];
  data: LabelData | null;
  ctx: RenderContext;
  outline?: boolean;
}) {
  const code = data?.assetCode ?? "";
  return (
    <div
      className={`relative overflow-hidden bg-white text-black ${outline ? "outline outline-dashed outline-neutral-300" : ""}`}
      style={{ width: `${width}mm`, height: `${height}mm`, fontFamily: "var(--font-sarabun), var(--font-inter), sans-serif" }}
    >
      {elements.map((e) => {
        switch (e.type) {
          case "text":
          case "field": {
            const value = e.type === "text" ? fillPlaceholders(e.text, ctx) : `${e.prefix}${(e.field === "orgName" ? ctx.orgName : data?.[e.field]) ?? ""}`;
            return (
              <div
                key={e.id}
                style={{
                  ...box(e),
                  fontSize: `${e.fontSize}pt`,
                  fontWeight: e.bold ? 700 : 400,
                  textAlign: e.align,
                  color: e.color,
                  lineHeight: 1.15,
                  overflow: "hidden",
                  wordBreak: "break-word",
                }}
              >
                {value}
              </div>
            );
          }
          case "barcode":
            return (
              <div key={e.id} style={box(e)}>
                {code && <Barcode value={code} showText={e.showText} />}
              </div>
            );
          case "qr":
            return (
              <div key={e.id} style={box(e)}>
                {code && <Qr value={`${ctx.origin}/a/${encodeURIComponent(code)}`} />}
              </div>
            );
          case "image":
            return (
              // eslint-disable-next-line @next/next/no-img-element -- served by the authorised file route
              <img key={e.id} src={`/api/files/${e.attachmentId}`} alt="" style={{ ...box(e), objectFit: "contain" }} />
            );
          case "rect":
            return (
              <div
                key={e.id}
                style={{
                  ...box(e),
                  background: e.fill === "transparent" ? undefined : e.fill,
                  border: e.strokeWidth > 0 && e.stroke !== "transparent" ? `${e.strokeWidth}mm solid ${e.stroke}` : undefined,
                  borderRadius: `${e.radius}mm`,
                  printColorAdjust: "exact",
                  WebkitPrintColorAdjust: "exact",
                }}
              />
            );
        }
      })}
    </div>
  );
}
