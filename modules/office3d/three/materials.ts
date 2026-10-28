import { Color, type Material, type Mesh, MeshBasicMaterial, type MeshStandardMaterial, type Object3D } from "three";

/** Status lights become unlit so the per-instance colour shows as-is (instanceColor multiplies a white base). */
export function statusLightMaterial(source: Material) {
  const m = new MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  m.name = source.name;
  return m;
}

/**
 * Recolour a named material on one object only: GLTFLoader shares materials between copies of a file,
 * so the material is cloned for this object first (IMPLEMENTATION.md §6.4). Returns the clones to dispose.
 */
export function setMaterialColor(root: Object3D, name: string, hex: string, emissive = false) {
  const clones: Material[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const swap = (mat: Material) => {
      if (mat.name !== name) return mat;
      const c = (mat.userData.recoloured ? mat : mat.clone()) as MeshStandardMaterial;
      if (!mat.userData.recoloured) clones.push(c);
      c.userData.recoloured = true;
      c.color = new Color(hex);
      if (emissive && c.emissive) c.emissive = new Color(hex).multiplyScalar(0.6);
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
  return clones;
}
