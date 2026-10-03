// The "AI cannot break your level design" guarantee, visual side.
// Rodin returns models at an arbitrary scale, centred on their middle. fitToVolume puts any
// model INSIDE its contract box: uniform scale, optional 90° turn when that fits better,
// then a mild sideways stretch (≤ MAX_STRETCH, never taller) to fill the footprint, bottom
// on the ground, centred in X/Z. The mesh can never stick out of its collider, so what you
// see never contradicts what you collide with.
import { Box3, Vector3, type Object3D } from "three";

/** Max extra horizontal stretch on top of the uniform fit. 1.25 = up to 25% wider/deeper. */
export const MAX_STRETCH = 1.25;

export interface FitResult {
  scale: number; // uniform base scale
  stretch: [number, number]; // extra factor on the model's own X and Z (1 = none)
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
  const ex = Math.max(e.x, 1e-6);
  const ey = Math.max(e.y, 1e-6);
  const ez = Math.max(e.z, 1e-6);
  const [w, h, d] = size;
  const sA = Math.min(w / ex, h / ey, d / ez);
  const sB = Math.min(w / ez, h / ey, d / ex);
  const rotated = sB > sA * 1.01;
  const scale = rotated ? sB : sA;

  // Box extents along the model's own X and Z (swapped when the model is turned).
  const boxX = rotated ? d : w;
  const boxZ = rotated ? w : d;
  const kx = Math.min(boxX / (ex * scale), MAX_STRETCH);
  const kz = Math.min(boxZ / (ez * scale), MAX_STRETCH);

  obj.rotation.y = rotated ? Math.PI / 2 : 0;
  obj.scale.set(scale * kx, scale, scale * kz);
  obj.updateMatrixWorld(true);
  const b = new Box3().setFromObject(obj);
  const c = b.getCenter(new Vector3());
  obj.position.set(-c.x, -b.min.y, -c.z);
  obj.updateMatrixWorld(true);

  const fill = (ex * kx * ey * ez * kz * scale ** 3) / (w * h * d);
  return { scale, stretch: [kx, kz], rotated, fill };
}
