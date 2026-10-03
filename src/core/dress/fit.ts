// The "AI cannot break your level design" guarantee, visual side.
// Rodin returns models at an arbitrary scale, centred on their middle. fitToVolume puts any
// model INSIDE its contract box: uniform scale (no stretching), optional 90° turn when that
// fits better, bottom on the ground, centred in X/Z. The mesh can never stick out of its
// collider, so what you see never contradicts what you collide with.
import { Box3, Vector3, type Object3D } from "three";

export interface FitResult {
  scale: number;
  rotated: boolean; // turned 90° around Y to match the box's long side
  /** Fraction of the box's volume filled by the model's bounding box, 0..1. */
  fill: number;
}

/**
 * Mutates `obj` (pass a clone of a cached GLTF scene). Afterwards, place `obj` inside a
 * parent positioned at the volume's position/rotationY: the model's bottom-centre is at the
 * parent origin, matching the contract's "position = bottom-centre" convention.
 */
export function fitToVolume(obj: Object3D, size: [number, number, number]): FitResult {
  obj.position.set(0, 0, 0);
  obj.rotation.set(0, 0, 0);
  obj.scale.set(1, 1, 1);
  obj.updateMatrixWorld(true);
  const e = new Box3().setFromObject(obj).getSize(new Vector3());
  const [w, h, d] = size;
  const eps = 1e-6;
  const sA = Math.min(w / Math.max(e.x, eps), h / Math.max(e.y, eps), d / Math.max(e.z, eps));
  const sB = Math.min(w / Math.max(e.z, eps), h / Math.max(e.y, eps), d / Math.max(e.x, eps));
  const rotated = sB > sA * 1.01;
  const scale = rotated ? sB : sA;

  obj.rotation.y = rotated ? Math.PI / 2 : 0;
  obj.scale.setScalar(scale);
  obj.updateMatrixWorld(true);
  const b = new Box3().setFromObject(obj);
  const c = b.getCenter(new Vector3());
  obj.position.set(-c.x, -b.min.y, -c.z);
  obj.updateMatrixWorld(true);

  const fill = (e.x * e.y * e.z * scale ** 3) / (w * h * d);
  return { scale, rotated, fill };
}
