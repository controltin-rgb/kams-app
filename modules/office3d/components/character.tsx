"use client";

import { useEffect, useMemo, useRef } from "react";
import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Box3, CircleGeometry, type Group, InstancedMesh, Matrix4, MeshBasicMaterial, type Object3D, Vector3 } from "three";
import { cloneCharacter, createController } from "../agents/controller";
import { modelKeyUrl } from "../models";
import type { SceneAgent } from "../scene";
import { nodeLocalMatrix } from "../three/anchors";
import { followBody, followSocket, placeShadows } from "../three/frame";
import { HAND_PROPS } from "../agents/runner";
import type { Hit } from "./hit";
import { useRuntime } from "./runtime-context";

const HIT_SIZE = new Vector3(0.6, 1.6, 0.6);
/** Room for visitors on top of the seated people */
const SHADOW_CAPACITY = 48;

/** Bounds used for hover/selection of a character */
export function agentBox(p: { position: Vector3; sitting: boolean }) {
  const center = p.position.clone().setY(p.sitting ? 0.65 : 0.8);
  return new Box3().setFromCenterAndSize(center, p.sitting ? HIT_SIZE.clone().setY(1.3) : HIT_SIZE);
}


/** Soft contact shadows under everyone, as one instanced mesh (1 draw call for all people), following them as they walk. */
export function AgentShadows() {
  const runtime = useRuntime();
  const mesh = useMemo(() => {
    const m = new InstancedMesh(new CircleGeometry(0.32, 24), new MeshBasicMaterial({ color: "#3b2f25", transparent: true, opacity: 0.22, depthWrite: false }), SHADOW_CAPACITY);
    m.count = 0;
    m.frustumCulled = false; // instances move; the bounding sphere would go stale
    return m;
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
      mesh.dispose();
    },
    [mesh],
  );
  useFrame(() => placeShadows(mesh, runtime.list().slice(0, SHADOW_CAPACITY).map((a) => a.pos)));
  return <primitive object={mesh} />;
}

/** A person in the office. The runtime places it every frame and picks its clips (agents/runner.ts). */
export function Character({ agent, onHover, onSelect }: { agent: SceneAgent; onHover: (hit: Hit | null) => void; onSelect: (hit: Hit) => void }) {
  const runtime = useRuntime();
  const { scene, animations } = useGLTF(modelKeyUrl(agent.model));
  // No real shadows: each character is 5 draw calls, doubled by the shadow pass (see AgentShadows).
  const body = useMemo(() => cloneCharacter(scene), [scene]);
  const ref = useRef<Group>(null);
  const { actions, mixer } = useAnimations(animations, ref);

  useEffect(() => {
    if (!ref.current) return;
    const ctrl = createController(ref.current, body, actions, mixer);
    runtime.register(agent.id, ctrl);
    return () => runtime.unregister(agent.id, ctrl);
  }, [runtime, agent.id, body, actions, mixer]);

  const hit = (): Hit | null => {
    const a = runtime.agent(agent.id);
    return a ? { kind: "agent", agentId: agent.id, box: agentBox({ position: a.pos, sitting: a.sitting }) } : null;
  };

  return (
    <group ref={ref}>
      <primitive object={body} />
      {/* Invisible hit box: cheaper and steadier to point at than the animated skinned mesh */}
      <mesh
        visible={false}
        position={[0, HIT_SIZE.y / 2, 0]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onHover(hit());
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const h = hit();
          if (h) onSelect(h);
        }}
      >
        <boxGeometry args={[HIT_SIZE.x, HIT_SIZE.y, HIT_SIZE.z]} />
      </mesh>
    </group>
  );
}

/** Follows an agent around (speech bubbles); children are placed relative to the agent's feet. */
export function FollowAgent({ agentId, children }: { agentId: string; children: React.ReactNode }) {
  const runtime = useRuntime();
  const ref = useRef<Group>(null);
  useFrame(() => {
    const a = runtime.agent(agentId);
    if (a && ref.current) ref.current.position.copy(a.pos);
  });
  return <group ref={ref}>{children}</group>;
}

/** Boxes and equipment carried in both arms sit here, in the character's own frame (chest height, in front) */
const CARRY_AT = new Matrix4().makeTranslation(0, 0.72, 0.3);

/**
 * Something an agent holds. Small props (ticket paper, phone, ...) keep their grip (anchor_hand_r) on the right-hand
 * socket; boxes and equipment are carried in front of the chest, matching walk_carry / idle_carry.
 */
export function HeldProp({ agentId, prop, model }: { agentId: string; prop: string; model: Object3D }) {
  const runtime = useRuntime();
  const inHand = HAND_PROPS.has(prop);
  const { object, grip } = useMemo(() => {
    const obj = model.clone(true);
    obj.matrixAutoUpdate = false;
    const local = nodeLocalMatrix(obj, "anchor_hand_r");
    return { object: obj, grip: local ? local.invert() : new Matrix4() };
  }, [model]);
  useFrame(() => {
    const ctrl = runtime.agent(agentId)?.ctrl;
    if (!ctrl) return;
    const socket = inHand ? ctrl.socket("r") : null;
    if (socket) followSocket(object, socket, grip);
    else followBody(object, ctrl.root, CARRY_AT);
  });
  return <primitive object={object} />;
}
