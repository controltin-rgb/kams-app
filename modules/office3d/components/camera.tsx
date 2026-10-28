"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { type OrthographicCamera as OrthoCamera, Vector3 } from "three";
import type { Vec3 } from "../models";
import { easeCamera, type OrbitTarget } from "../three/frame";
import { useRuntime } from "./runtime-context";

const TARGET: Vec3 = [0.3, 0, -0.3];
const ISO_AZIMUTH = -Math.PI / 4; // camera at (-14, 14, 14)
// Projected size of the 14×10 m room (+ walls) from the isometric camera, in world units
const VIEW_W = 18;
const VIEW_H = 13.5;
/** Zoom while following someone, relative to the whole-room zoom */
const FOLLOW_ZOOM = 2.4;
/** Where the camera looks at a followed person (chest height) */
const FOLLOW_HEIGHT = 0.8;

/** Orthographic zoom that fits the whole room */
export const fitZoom = (size: { width: number; height: number }) => Math.min(size.width / VIEW_W, size.height / VIEW_H);

/** Isometric camera fitted to the room, with limited orbit. `locked` = no orbiting (layout editing drags on the floor). */
export function CameraRig({ locked }: { locked: boolean }) {
  const size = useThree((s) => s.size);
  const fit = fitZoom(size);
  return (
    <>
      <OrthographicCamera makeDefault position={[-14, 14, 14]} zoom={fit} near={0.1} far={100} />
      <OrbitControls
        makeDefault
        enabled={!locked}
        target={TARGET}
        enablePan={false}
        enableDamping
        minPolarAngle={0.55}
        maxPolarAngle={1.2}
        minAzimuthAngle={ISO_AZIMUTH - 0.7}
        maxAzimuthAngle={ISO_AZIMUTH + 0.7}
        minZoom={fit * 0.8}
        maxZoom={fit * 4}
      />
    </>
  );
}

/**
 * Follow camera (IMPLEMENTATION.md §8 3D-5): glides to the followed person and keeps them centred, zoomed in;
 * when following stops it glides back to the whole room. `onLost` = the person left the office (visitor gone).
 */
export function FollowCamera({ agentId, onLost }: { agentId: string | null; onLost: () => void }) {
  const runtime = useRuntime();
  const controls = useThree((s) => s.controls) as unknown as OrbitTarget | null;
  const camera = useThree((s) => s.camera) as OrthoCamera;
  const size = useThree((s) => s.size);
  const returning = useRef(false);
  const point = useMemo(() => new Vector3(), []);
  const home = useMemo(() => new Vector3(...TARGET), []);

  // Stopped following (or switched person): glide back
  useEffect(() => {
    if (!agentId) return;
    returning.current = false;
    return () => void (returning.current = true);
  }, [agentId]);

  useFrame((_, dt) => {
    if (!controls || !camera.isOrthographicCamera) return;
    const k = 1 - Math.exp(-dt * 4);
    const fit = fitZoom(size);
    if (agentId) {
      const a = runtime.agent(agentId);
      if (!a) return onLost();
      easeCamera(controls, camera, point.set(a.pos.x, FOLLOW_HEIGHT, a.pos.z), fit * FOLLOW_ZOOM, k);
    } else if (returning.current && easeCamera(controls, camera, home, fit, k)) {
      returning.current = false;
    }
  });
  return null;
}
