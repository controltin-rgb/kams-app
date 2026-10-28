// Runs the director's scenes in the 3D view: one frame loop drives every scene as a set of generators
// (one per action), moving characters along nav-grid paths. Nothing here touches React state per frame.

import { Quaternion, Vector3 } from "three";
import { CATCH_UP_QUEUE, nextScenes, planScene, type Action, type Scene, type Target, type World } from "../director";
import type { SceneEventMessage } from "../events";
import { WALK_SPEED } from "../models";
import type { NavGrid } from "../nav/grid";
import { QUEUE_GAP, Reservations } from "../nav/reservation";
import type { MarkerKind, SceneAgent } from "../scene";
import type { Resolved } from "../three/targets";
import { type CharacterController, ONCE_CLIPS } from "./controller";

/** Floor position + facing of an agent's usual place */
export type Home = { position: Vector3; quaternion: Quaternion; sitting: boolean };

export type RuntimeAgent = {
  spec: SceneAgent;
  home: Home;
  pos: Vector3;
  quat: Quaternion;
  sitting: boolean;
  ctrl: CharacterController | null;
  /** Clip the runtime last asked for, replayed when the character (re)mounts */
  clip: string;
  /** Carrying something in both arms: walk_carry / idle_carry instead of walk / idle */
  carry: boolean;
};

/** Props held in one hand; anything else (boxes, equipment) is carried in both arms */
export const HAND_PROPS = new Set(["ticket_paper", "smartphone", "clipboard", "screwdriver"]);

export type RuntimeHooks = {
  commit(event: SceneEventMessage): void;
  visitors(list: SceneAgent[]): void;
  bubble(agentId: string, text: string | null): void;
  hold(agentId: string, prop: string | null): void;
  flash(agentId: string, marker: MarkerKind | null): void;
  /** status_ring around a layout item (colour) or gone (null) */
  ring(item: string, color: string | null): void;
  /** Layout items taken off their place (true) or put back (false) */
  hide(items: string[], hidden: boolean): void;
  queue(waiting: number, running: number): void;
};

type Task = Generator<void, void, void>;
type Running = { scene: Scene; task: Task; committed: boolean };

const TURN_SPEED = 7; // rad/s
const ARRIVED = 0.03;
const SPAWN_TIMEOUT = 15; // s
const UP = new Vector3(0, 1, 0);

const yawTowards = (from: Vector3, to: Vector3) => new Quaternion().setFromAxisAngle(UP, Math.atan2(to.x - from.x, to.z - from.z));

/** 0..1, stable per agent: where in its loop an agent starts so people do not move in sync */
const phaseOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 100) / 100;
};

export class OfficeRuntime {
  private agents = new Map<string, RuntimeAgent>();
  private waiting: Scene[] = [];
  private running: Running[] = [];
  private reservations = new Reservations();
  private visitors: SceneAgent[] = [];
  /** Agents with a bubble / prop / flash showing, to clear them on catch-up */
  private shown = { bubble: new Set<string>(), hold: new Set<string>(), flash: new Set<string>() };
  private hiddenItems = new Set<string>();
  private rings = new Set<string>();
  private dt = 0;
  private speed = 1;
  private paused = false;
  private lastQueue = "";

  constructor(
    private world: World,
    homes: Map<string, Home>,
    private grid: NavGrid,
    private resolve: (target: Target) => Resolved | null,
    private hooks: RuntimeHooks,
  ) {
    for (const spec of world.agents) {
      const home = homes.get(spec.id);
      if (home) this.agents.set(spec.id, { spec, home, pos: home.position.clone(), quat: home.quaternion.clone(), sitting: home.sitting, ctrl: null, clip: spec.clip, carry: false });
    }
  }

  /** Bound assets reloaded (after a swap): later scenes find assets at their new places. */
  setAssetItems(assetItems: Record<string, string>) {
    this.world = { ...this.world, assetItems };
  }

  // ---------- Wiring ----------

  agent(id: string) {
    return this.agents.get(id);
  }
  list() {
    return [...this.agents.values()];
  }

  /** A character mounted: place it and start its usual clip. */
  register(id: string, ctrl: CharacterController) {
    const a = this.agents.get(id);
    if (!a) return;
    a.ctrl = ctrl;
    ctrl.root.position.copy(a.pos);
    ctrl.root.quaternion.copy(a.quat);
    ctrl.setTimeScale(this.paused ? 0 : this.speed);
    ctrl.play(a.clip, phaseOf(id));
  }
  unregister(id: string, ctrl: CharacterController) {
    const a = this.agents.get(id);
    if (a?.ctrl === ctrl) a.ctrl = null;
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.timeScale();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    this.timeScale();
  }
  private timeScale() {
    for (const a of this.agents.values()) a.ctrl?.setTimeScale(this.paused ? 0 : this.speed);
  }

  /** New event from the stream. A hidden tab (no frames) jumps straight to the end state. */
  receive(event: SceneEventMessage, hidden = false) {
    this.waiting.push(planScene(event, this.world));
    if (hidden) this.catchUp();
    this.reportQueue();
  }

  // ---------- Frame loop ----------

  update(dt: number) {
    if (this.paused) return;
    // Checked per frame, so a burst that arrives in one poll is skipped as a whole
    if (this.waiting.length > CATCH_UP_QUEUE) this.catchUp();
    this.dt = dt * this.speed;
    for (const scene of nextScenes(this.waiting, this.running.map((r) => r.scene))) {
      this.waiting = this.waiting.filter((s) => s !== scene);
      const run: Running = { scene, committed: false, task: this.play(scene, () => (run.committed = true)) };
      this.running.push(run);
    }
    this.running = this.running.filter((r) => !r.task.next().done);
    for (const a of this.agents.values()) {
      if (!a.ctrl) continue;
      a.ctrl.root.position.copy(a.pos);
      a.ctrl.root.quaternion.copy(a.quat);
    }
    this.reportQueue();
  }

  private reportQueue() {
    const key = `${this.waiting.length}/${this.running.length}`;
    if (key === this.lastQueue) return;
    this.lastQueue = key;
    this.hooks.queue(this.waiting.length, this.running.length);
  }

  /**
   * Skip to the end state of everything running or waiting (queue too long, tab hidden): apply the events in order,
   * remove temporary characters and put everyone back in their usual place.
   */
  catchUp() {
    const pending = [...this.running.map((r) => ({ scene: r.scene, committed: r.committed })), ...this.waiting.map((scene) => ({ scene, committed: false }))];
    for (const { scene, committed } of pending) {
      if (committed) continue;
      for (const step of scene.steps) for (const action of step) if (action.do === "commit") this.hooks.commit(action.event);
    }
    this.running = [];
    this.waiting = [];
    this.reservations.clear();
    for (const v of this.visitors) this.agents.delete(v.id);
    if (this.visitors.length) {
      this.visitors = [];
      this.hooks.visitors([]);
    }
    for (const id of this.shown.bubble) this.hooks.bubble(id, null);
    for (const id of this.shown.hold) this.hooks.hold(id, null);
    for (const id of this.shown.flash) this.hooks.flash(id, null);
    this.shown = { bubble: new Set(), hold: new Set(), flash: new Set() };
    if (this.hiddenItems.size) this.hooks.hide([...this.hiddenItems], false);
    this.hiddenItems.clear();
    for (const item of this.rings) this.hooks.ring(item, null);
    this.rings.clear();
    for (const a of this.agents.values()) {
      a.carry = false;
      a.pos.copy(a.home.position);
      a.quat.copy(a.home.quaternion);
      a.sitting = a.home.sitting;
      a.clip = a.spec.clip;
      a.ctrl?.play(a.clip, phaseOf(a.spec.id));
    }
    this.reportQueue();
  }

  // ---------- Scenes ----------

  private *play(scene: Scene, committed: () => void): Task {
    for (const step of scene.steps) {
      let tasks = step.map((action) => this.action(action, committed));
      for (;;) {
        tasks = tasks.filter((t) => !t.next().done);
        if (!tasks.length) break;
        yield;
      }
    }
  }

  private *action(action: Action, committed: () => void): Task {
    if (action.do === "commit") {
      committed();
      this.hooks.commit(action.event);
      return;
    }
    if (action.do === "spawn") return yield* this.spawn(action.agent, action.at);
    if (action.do === "ring") {
      this.rings.add(action.item);
      this.hooks.ring(action.item, action.color);
      yield* this.wait(action.seconds);
      this.rings.delete(action.item);
      return this.hooks.ring(action.item, null);
    }
    if (action.do === "hide") {
      for (const item of action.items) {
        if (action.hidden) this.hiddenItems.add(item);
        else this.hiddenItems.delete(item);
      }
      return this.hooks.hide(action.items, action.hidden);
    }
    const a = this.agents.get(action.agent);
    if (!a) return;
    switch (action.do) {
      case "walk":
        return yield* this.walk(a, action.to, action.reserve);
      case "home":
        return yield* this.goHome(a);
      case "clip": {
        const length = this.clip(a, action.clip);
        return yield* this.wait(action.seconds ?? (ONCE_CLIPS.has(action.clip) ? length : 1));
      }
      case "say":
        this.show("bubble", a.spec.id, true);
        this.hooks.bubble(a.spec.id, action.text);
        yield* this.wait(action.seconds);
        this.show("bubble", a.spec.id, false);
        return this.hooks.bubble(a.spec.id, null);
      case "hold":
        this.show("hold", a.spec.id, !!action.prop);
        a.carry = !!action.prop && !HAND_PROPS.has(action.prop);
        if (a.clip === "idle" || a.clip === "idle_carry") this.clip(a, "idle");
        return this.hooks.hold(a.spec.id, action.prop);
      case "flash":
        this.show("flash", a.spec.id, true);
        this.hooks.flash(a.spec.id, action.marker);
        yield* this.wait(action.seconds);
        this.show("flash", a.spec.id, false);
        return this.hooks.flash(a.spec.id, null);
      case "release":
        return this.reservations.leave(action.spot, a.spec.id);
      case "despawn":
        this.reservations.leaveAll(a.spec.id);
        this.agents.delete(a.spec.id);
        this.visitors = this.visitors.filter((v) => v.id !== a.spec.id);
        return this.hooks.visitors(this.visitors);
    }
  }

  private show(kind: keyof OfficeRuntime["shown"], id: string, on: boolean) {
    if (on) this.shown[kind].add(id);
    else this.shown[kind].delete(id);
  }

  private clip(a: RuntimeAgent, name: string) {
    // Carrying: the two-armed versions of walking and standing
    const clip = a.carry && name === "walk" ? "walk_carry" : a.carry && name === "idle" ? "idle_carry" : name;
    a.clip = clip;
    return a.ctrl?.play(clip) ?? 1;
  }

  private *wait(seconds: number): Task {
    let t = 0;
    while (t < seconds) {
      yield;
      t += this.dt;
    }
  }

  private *spawn(spec: SceneAgent, at: Target): Task {
    const spot = this.resolve(at);
    if (!spot || this.agents.has(spec.id)) return;
    const quaternion = spot.quaternion ?? new Quaternion();
    this.agents.set(spec.id, { spec, home: { position: spot.position, quaternion, sitting: false }, pos: spot.position.clone(), quat: quaternion.clone(), sitting: false, ctrl: null, clip: spec.clip, carry: false });
    this.visitors = [...this.visitors, spec];
    this.hooks.visitors(this.visitors);
    // Wait for the character to mount (its model may still be loading) so nobody walks in unseen
    for (let t = 0; t < SPAWN_TIMEOUT && !this.agents.get(spec.id)?.ctrl; t += Math.max(this.dt, 1 / 60)) yield;
  }

  private *standUp(a: RuntimeAgent): Task {
    if (!a.sitting) return;
    yield* this.wait(this.clip(a, "stand_up"));
    a.sitting = false;
  }

  /** Walk along a nav path to `goal`. Returns false when `interrupted` asks to re-plan (queue moved up). */
  private *moveTo(a: RuntimeAgent, goal: Vector3, interrupted: () => boolean = () => false): Generator<void, boolean, void> {
    if (a.pos.distanceTo(goal) <= ARRIVED) return true;
    const path = this.grid.findPath({ x: a.pos.x, z: a.pos.z }, { x: goal.x, z: goal.z }) ?? [
      { x: a.pos.x, z: a.pos.z },
      { x: goal.x, z: goal.z },
    ];
    this.clip(a, "walk");
    for (const p of path.slice(1)) {
      const point = new Vector3(p.x, 0, p.z);
      while (a.pos.distanceTo(point) > ARRIVED) {
        if (interrupted()) return false;
        const step = WALK_SPEED * this.dt;
        const facing = yawTowards(a.pos, point);
        a.quat.rotateTowards(facing, TURN_SPEED * this.dt);
        if (a.pos.distanceTo(point) <= step) a.pos.copy(point);
        else a.pos.add(point.clone().sub(a.pos).setY(0).normalize().multiplyScalar(step));
        yield;
      }
    }
    return true;
  }

  private *turnTo(a: RuntimeAgent, q: Quaternion): Task {
    while (a.quat.angleTo(q) > 0.02) {
      a.quat.rotateTowards(q, TURN_SPEED * this.dt);
      yield;
    }
  }

  private facing(spot: Resolved, target: Target, a: RuntimeAgent) {
    const face = target.face ? this.agents.get(target.face)?.pos : null;
    if (face) return yawTowards(a.pos, face);
    if (spot.quaternion) return spot.quaternion;
    return spot.lookAt ? yawTowards(a.pos, spot.lookAt) : a.quat.clone();
  }

  private *walk(a: RuntimeAgent, target: Target, reserve?: string): Task {
    const spot = this.resolve(target);
    if (!spot) return;
    yield* this.standUp(a);
    const id = a.spec.id;
    if (reserve) this.reservations.join(reserve, id);
    // Behind the spot = against the way people face there
    const back = new Vector3(0, 0, -1).applyQuaternion(spot.quaternion ?? new Quaternion());
    for (;;) {
      const place = reserve ? this.reservations.place(reserve, id) : 0;
      const goal = spot.position.clone().addScaledVector(back, QUEUE_GAP * Math.max(0, place));
      const arrived = yield* this.moveTo(a, goal, () => !!reserve && this.reservations.place(reserve, id) !== place);
      if (!arrived) continue;
      if (place <= 0) break;
      // In line: face the spot and wait to move up
      this.clip(a, "idle");
      yield* this.turnTo(a, yawTowards(a.pos, spot.position));
      while (this.reservations.place(reserve!, id) === place) yield;
    }
    this.clip(a, "idle");
    yield* this.turnTo(a, this.facing(spot, target, a));
  }

  private *goHome(a: RuntimeAgent): Task {
    const { home } = a;
    if (a.pos.distanceTo(home.position) > ARRIVED) {
      yield* this.standUp(a);
      yield* this.moveTo(a, home.position);
      this.clip(a, "idle");
    }
    yield* this.turnTo(a, home.quaternion);
    if (home.sitting && !a.sitting) {
      yield* this.wait(this.clip(a, "sit_down"));
      a.sitting = true;
    }
    this.clip(a, a.spec.clip);
  }
}
