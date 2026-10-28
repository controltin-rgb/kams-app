"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import type Konva from "konva";
import QRCode from "qrcode";
import { Group, Image as KImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { fillPlaceholders, sampleLabelData, type LabelElement } from "@/modules/labels/design";

const PT_TO_MM = 0.3528;
const SNAP = 0.5; // mm

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

function makeBarcode(value: string) {
  const c = document.createElement("canvas");
  try {
    JsBarcode(c, value, { format: "CODE128", margin: 0, height: 60, width: 2, displayValue: false });
    return c;
  } catch {
    return null;
  }
}

/** Image source for barcode (sync), QR and uploaded images (async). Client-only component. */
function useCanvasSource(kind: "barcode" | "qr" | "image", value: string) {
  const barcode = useMemo(() => (kind === "barcode" ? makeBarcode(value) : null), [kind, value]);
  const [loaded, setLoaded] = useState<{ key: string; src: CanvasImageSource } | null>(null);
  const key = `${kind}:${value}`;
  useEffect(() => {
    if (kind === "barcode") return;
    let alive = true;
    if (kind === "qr") {
      const c = document.createElement("canvas");
      QRCode.toCanvas(c, value, { margin: 0, width: 256 }).then(() => alive && setLoaded({ key, src: c }));
    } else {
      const img = new window.Image();
      img.onload = () => alive && setLoaded({ key, src: img });
      img.src = value;
    }
    return () => {
      alive = false;
    };
  }, [kind, value, key]);
  return barcode ?? (loaded?.key === key ? loaded.src : null);
}

function readFontFamily() {
  // next/font exposes hashed family names through CSS variables
  const css = getComputedStyle(document.documentElement);
  const families = [css.getPropertyValue("--font-sarabun"), css.getPropertyValue("--font-inter")].map((f) => f.trim()).filter(Boolean);
  return families.length ? `${families.join(", ")}, sans-serif` : "sans-serif";
}

function ImageNode({ kind, value, w, h }: { kind: "barcode" | "qr" | "image"; value: string; w: number; h: number }) {
  const src = useCanvasSource(kind, value);
  if (!src) return <Rect width={w} height={h} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1} dash={[4, 3]} />;
  return <KImage image={src} width={w} height={h} />;
}

export function KonvaStage({
  widthMm,
  heightMm,
  scale,
  elements,
  selectedId,
  orgName,
  readOnly,
  onSelect,
  onChange,
}: {
  widthMm: number;
  heightMm: number;
  scale: number;
  elements: LabelElement[];
  selectedId: string | null;
  orgName: string;
  readOnly: boolean;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<LabelElement>) => void;
}) {
  const trRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const [fontFamily] = useState(readFontFamily);
  const ctx = useMemo(() => ({ orgName, now: new Date() }), [orgName]);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodes.current.get(selectedId) : undefined;
    tr.nodes(node && !readOnly ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, elements, readOnly]);

  const W = widthMm * scale;
  const H = heightMm * scale;
  const grid = useMemo(() => {
    const lines: number[][] = [];
    for (let x = 5; x < widthMm; x += 5) lines.push([x * scale, 0, x * scale, H]);
    for (let y = 5; y < heightMm; y += 5) lines.push([0, y * scale, W, y * scale]);
    return lines;
  }, [widthMm, heightMm, scale, W, H]);

  return (
    <Stage
      width={W + 2}
      height={H + 2}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === "background") onSelect(null);
      }}
    >
      <Layer>
        <Rect name="background" x={1} y={1} width={W} height={H} fill="#ffffff" stroke="#9ca3af" strokeWidth={1} />
        {grid.map((pts, i) => (
          <Line key={i} points={pts.map((p) => p + 1)} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />
        ))}
        <Group x={1} y={1} clipX={0} clipY={0} clipWidth={W} clipHeight={H}>
          {elements.map((e) => {
            const w = e.w * scale;
            const h = e.h * scale;
            return (
              <Group
                key={e.id}
                ref={(node) => {
                  if (node) nodes.current.set(e.id, node);
                  else nodes.current.delete(e.id);
                }}
                x={e.x * scale}
                y={e.y * scale}
                rotation={e.rotation}
                draggable={!readOnly}
                onMouseDown={() => onSelect(e.id)}
                onTap={() => onSelect(e.id)}
                onDragEnd={(ev) => onChange(e.id, { x: snap(ev.target.x() / scale), y: snap(ev.target.y() / scale) })}
                onTransformEnd={(ev) => {
                  const n = ev.target;
                  const patch = {
                    x: snap(n.x() / scale),
                    y: snap(n.y() / scale),
                    w: Math.max(1, snap((w * n.scaleX()) / scale)),
                    h: Math.max(1, snap((h * n.scaleY()) / scale)),
                    rotation: Math.round(n.rotation()),
                  };
                  n.scaleX(1);
                  n.scaleY(1);
                  onChange(e.id, patch);
                }}
              >
                {(e.type === "text" || e.type === "field") && (
                  <>
                    <Rect width={w} height={h} fill="transparent" />
                    <Text
                      width={w}
                      height={h}
                      text={e.type === "text" ? fillPlaceholders(e.text, ctx) : `${e.prefix}${e.field === "orgName" ? orgName : (sampleLabelData[e.field] ?? "")}`}
                      fontSize={e.fontSize * PT_TO_MM * scale}
                      fontFamily={fontFamily}
                      fontStyle={e.bold ? "bold" : "normal"}
                      align={e.align}
                      fill={e.color}
                      lineHeight={1.15}
                      wrap="word"
                      ellipsis
                    />
                  </>
                )}
                {e.type === "barcode" && <ImageNode kind="barcode" value={sampleLabelData.assetCode ?? "PC-2026-0001"} w={w} h={h} />}
                {e.type === "qr" && <ImageNode kind="qr" value={`https://example.com/a/${sampleLabelData.assetCode}`} w={w} h={h} />}
                {e.type === "image" && <ImageNode kind="image" value={`/api/files/${e.attachmentId}`} w={w} h={h} />}
                {e.type === "rect" && (
                  <Rect
                    width={w}
                    height={h}
                    fill={e.fill === "transparent" ? undefined : e.fill}
                    stroke={e.stroke === "transparent" ? undefined : e.stroke}
                    strokeWidth={e.strokeWidth * scale}
                    cornerRadius={e.radius * scale}
                  />
                )}
              </Group>
            );
          })}
        </Group>
        <Transformer
          ref={trRef}
          rotationSnaps={[0, 90, 180, 270]}
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 4 || newBox.height < 4 ? oldBox : newBox)}
        />
      </Layer>
    </Stage>
  );
}
