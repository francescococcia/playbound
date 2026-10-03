// Footprint math for contract volumes. Used by BOTH Prove and FPS collision,
// so the bot and the player collide with exactly the same shapes.
import { SOLID_ROLES, type Volume } from "./types";

/** Distance on the ground plane (XZ) from a point to a volume's rotated footprint. 0 if inside. */
export function distanceToFootprint(x: number, z: number, v: Volume): number {
  const [lx, lz] = toLocal(x, z, v);
  const dx = Math.max(Math.abs(lx) - v.size[0] / 2, 0);
  const dz = Math.max(Math.abs(lz) - v.size[2] / 2, 0);
  return Math.hypot(dx, dz);
}

export function isSolid(v: Volume): boolean {
  return SOLID_ROLES.includes(v.role);
}

/**
 * Push a circle (the player, radius r) out of every solid volume and keep it inside bounds.
 * Returns the corrected [x, z]. Call once per frame after applying movement.
 */
export function resolveCollision(
  x: number,
  z: number,
  r: number,
  volumes: Volume[],
  bounds: number,
): [number, number] {
  for (const v of volumes) {
    if (!isSolid(v)) continue;
    const [lx, lz] = toLocal(x, z, v);
    const hx = v.size[0] / 2;
    const hz = v.size[2] / 2;
    // Closest point on the box to the circle centre (local space).
    const cx = clamp(lx, -hx, hx);
    const cz = clamp(lz, -hz, hz);
    let nx = lx - cx;
    let nz = lz - cz;
    const d = Math.hypot(nx, nz);
    if (d >= r) continue;
    let px: number;
    let pz: number;
    if (d > 1e-6) {
      nx /= d;
      nz /= d;
      px = cx + nx * r;
      pz = cz + nz * r;
    } else {
      // Centre is inside the box: exit through the nearest face.
      const ex = hx - Math.abs(lx);
      const ez = hz - Math.abs(lz);
      if (ex < ez) {
        px = Math.sign(lx || 1) * (hx + r);
        pz = lz;
      } else {
        px = lx;
        pz = Math.sign(lz || 1) * (hz + r);
      }
    }
    [x, z] = toWorld(px, pz, v);
  }
  const lim = bounds - r;
  return [clamp(x, -lim, lim), clamp(z, -lim, lim)];
}

function toLocal(x: number, z: number, v: Volume): [number, number] {
  const dx = x - v.position[0];
  const dz = z - v.position[2];
  const c = Math.cos(v.rotationY);
  const s = Math.sin(v.rotationY);
  // Inverse of three.js Y rotation.
  return [c * dx - s * dz, s * dx + c * dz];
}

function toWorld(lx: number, lz: number, v: Volume): [number, number] {
  const c = Math.cos(v.rotationY);
  const s = Math.sin(v.rotationY);
  return [v.position[0] + c * lx + s * lz, v.position[2] - s * lx + c * lz];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
