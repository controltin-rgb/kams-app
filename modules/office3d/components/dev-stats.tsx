"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Dev-only FPS / draw-call sampler (twice a second). Reports text so the caller can write it to the DOM without re-rendering. */
export function DevStats({ onSample }: { onSample: (text: string) => void }) {
  const acc = useRef({ frames: 0, time: 0 });
  useFrame((state, delta) => {
    const a = acc.current;
    a.frames++;
    a.time += delta;
    if (a.time < 0.5) return;
    const { calls, triangles } = state.gl.info.render; // previous frame (info resets at the start of each render)
    onSample(`${Math.round(a.frames / a.time)} FPS · ${calls} draw calls · ${(triangles / 1000).toFixed(1)}k tris`);
    a.frames = 0;
    a.time = 0;
  });
  return null;
}
