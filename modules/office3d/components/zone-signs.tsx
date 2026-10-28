"use client";

import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, type Object3D, SRGBColorSpace } from "three";
import { office3dZoneLabels } from "@/lib/labels";
import type { ScenePlacement } from "../models";

const HEIGHT = 2.45; // hanging signs, above head height
const FACE_CAMERA = -Math.PI / 4; // the isometric camera looks from (-x, +z)
const SIGN_W = 1;
const SIGN_H = 0.32;

/**
 * Thai text drawn by the browser onto a canvas: the page font and the browser's Thai shaping are used,
 * so vowels and tone marks render correctly (3D text libraries do not shape Thai).
 */
function useLabelTexture(text: string, fontsReady: boolean) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = Math.round((512 * SIGN_H) / SIGN_W);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const family = getComputedStyle(document.body).fontFamily || "sans-serif";
      let size = 72;
      do ctx.font = `600 ${size}px ${family}`;
      while (ctx.measureText(text).width > canvas.width * 0.88 && --size > 20);
      ctx.fillStyle = "#3b2f25";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2 + size * 0.06);
    }
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
    // fontsReady: redraw once web fonts are loaded (the first draw may use a fallback font)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, fontsReady]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

function ZoneSign({ label, zone, model, fontsReady }: { label: string; zone: ScenePlacement; model: Object3D; fontsReady: boolean }) {
  const sign = useMemo(() => model.clone(true), [model]);
  const texture = useLabelTexture(label, fontsReady);
  return (
    <group position={[zone.position[0], HEIGHT, zone.position[2]]} rotation={[0, FACE_CAMERA, 0]}>
      <primitive object={sign} />
      {/* anchor_text of zone_sign is at z = 0.05 */}
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[SIGN_W * 0.92, SIGN_H * 0.86]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

export function ZoneSigns({ zones, model }: { zones: Record<string, ScenePlacement>; model: Object3D }) {
  const fontsReady = useFontsReady();
  return Object.entries(office3dZoneLabels).map(([key, label]) =>
    zones[key] ? <ZoneSign key={key} label={label} zone={zones[key]} model={model} fontsReady={fontsReady} /> : null,
  );
}
