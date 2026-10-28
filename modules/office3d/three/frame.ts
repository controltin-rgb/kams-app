// Per-frame updates of three.js objects, kept out of components (React's immutability lint forbids mutating
// values held by hooks inside a component, but frame loops must).

import { type InstancedMesh, Matrix4, type Object3D, type OrthographicCamera, Quaternion, Vector3 } from "three";

const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const ONE = new Vector3(1, 1, 1);
const m = new Matrix4();
const at = new Vector3();

/** One flat blob shadow instance per position */
export function placeShadows(mesh: InstancedMesh, positions: Vector3[]) {
  positions.forEach((p, i) => mesh.setMatrixAt(i, m.compose(at.copy(p).setY(0.012), FLAT, ONE)));
  mesh.count = positions.length;
  mesh.instanceMatrix.needsUpdate = true;
}

const ZERO = new Matrix4().makeScale(0, 0, 0);

/** Instances in place, or collapsed to nothing where `visible` is false (no rebuild of the instanced mesh) */
export function showInstances(mesh: InstancedMesh, matrices: Matrix4[], visible: boolean[]) {
  matrices.forEach((mat, i) => mesh.setMatrixAt(i, visible[i] ? mat : ZERO));
  mesh.instanceMatrix.needsUpdate = true;
}

/** Hold something in both arms: in front of the chest, turning with the body */
export function followBody(prop: Object3D, root: Object3D, offset: Matrix4) {
  root.updateWorldMatrix(true, false);
  prop.matrix.multiplyMatrices(root.matrixWorld, offset);
  prop.matrixWorldNeedsUpdate = true;
}

/** Keep a prop's grip on a hand socket */
export function followSocket(prop: Object3D, socket: Object3D, grip: Matrix4) {
  socket.updateWorldMatrix(true, false);
  prop.matrix.multiplyMatrices(socket.matrixWorld, grip);
  prop.matrixWorldNeedsUpdate = true;
}

/** What the follow camera needs from OrbitControls */
export type OrbitTarget = { target: Vector3; update(): void };
const step = new Vector3();

/**
 * Glide the orbit target, and the camera with it (same view angle), a fraction `k` toward `to`, and the zoom toward
 * `zoom`. Returns true once both are there.
 */
export function easeCamera(controls: OrbitTarget, camera: OrthographicCamera, to: Vector3, zoom: number, k: number) {
  step.copy(to).sub(controls.target).multiplyScalar(k);
  controls.target.add(step);
  camera.position.add(step);
  camera.zoom += (zoom - camera.zoom) * k;
  camera.updateProjectionMatrix();
  controls.update();
  return controls.target.distanceToSquared(to) < 1e-4 && Math.abs(zoom - camera.zoom) < 0.05;
}
