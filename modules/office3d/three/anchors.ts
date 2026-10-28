import { Box3, Euler, MathUtils, Matrix4, type Object3D, Quaternion, Vector3 } from "three";
import type { LayoutItem } from "../models";

/** World matrix of a layout item (rotationY in degrees around Y). */
export function itemMatrix(item: Pick<LayoutItem, "position" | "rotationY">) {
  const q = new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(item.rotationY), 0));
  return new Matrix4().compose(new Vector3(...item.position), q, new Vector3(1, 1, 1));
}

/** Matrix of a named node relative to the model root (models are loaded once and never moved). */
export function nodeLocalMatrix(root: Object3D, name: string): Matrix4 | null {
  const node = root.getObjectByName(name);
  if (!node) return null;
  root.updateMatrixWorld(true);
  return new Matrix4().copy(root.matrixWorld).invert().multiply(node.matrixWorld);
}

/** World position/rotation of an anchor of a placed item (+Z of the anchor = the way a character should face). */
export function anchorWorld(item: LayoutItem, root: Object3D, name: string) {
  const local = nodeLocalMatrix(root, name) ?? new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  itemMatrix(item).multiply(local).decompose(position, quaternion, new Vector3());
  return { position, quaternion };
}

/** World-space bounds of a placed item, from the model's own bounds. */
export function itemBox(item: LayoutItem, root: Object3D) {
  return new Box3().setFromObject(root).applyMatrix4(itemMatrix(item));
}
