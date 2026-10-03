// Export: a zip a game engine can import.
//   level.json          contract (transforms, roles, prompts) + per-asset fit transform
//   assets/<id>.glb     the Rodin models (raw, as generated)
//   README.txt          how to import in Unity / Unreal / Godot
// The fit transform (computed with the same fitToVolume the app uses) places each raw GLB
// inside its box, so an engine reproduces exactly what you saw. Colliders = the boxes.
import JSZip from "jszip";
import { Group } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { fitToVolume } from "../dress/fit";
import type { Level, Volume } from "../types";

export const EXPORT_FORMAT = "playbound-level@1";

/** Model transform relative to the volume's bottom-centre (before the volume's rotationY). */
export interface AssetTransform {
  position: [number, number, number];
  rotationY: number;
  scale: [number, number, number];
}

export interface ExportedVolume {
  id: string;
  label: string;
  role: Volume["role"];
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
  collider: "box";
  prompt?: string;
  asset?: { file: string; transform: AssetTransform };
}

export interface ExportedLevel {
  format: typeof EXPORT_FORMAT;
  name: string;
  exportedAt: string;
  units: "meters";
  axes: string;
  styleNotes?: string;
  prove?: { status: string; reason?: string | null; coveredFraction?: number; message?: string };
  volumes: ExportedVolume[];
}

export interface ExportDeps {
  fetchBytes?: (url: string) => Promise<ArrayBuffer>;
  /** Compute the fit transform of a GLB for a box size. Default: three GLTFLoader + fitToVolume. */
  measure?: (glb: ArrayBuffer, size: [number, number, number]) => Promise<AssetTransform>;
}

export async function buildExportZip(level: Level, deps: ExportDeps = {}): Promise<Blob> {
  const fetchBytes = deps.fetchBytes ?? defaultFetch;
  const measure = deps.measure ?? measureWithThree;
  const zip = new JSZip();

  const volumes: ExportedVolume[] = [];
  for (const v of level.volumes) {
    const out: ExportedVolume = {
      id: v.id,
      label: v.label,
      role: v.role,
      position: v.position,
      rotationY: v.rotationY,
      size: v.size,
      collider: "box",
      prompt: v.prompt,
    };
    if (v.assetUrl && v.status === "ready") {
      const bytes = await fetchBytes(v.assetUrl);
      const file = `assets/${v.id}.glb`;
      zip.file(file, bytes);
      out.asset = { file, transform: await measure(bytes, v.size) };
    }
    volumes.push(out);
  }

  const json: ExportedLevel = {
    format: EXPORT_FORMAT,
    name: level.name,
    exportedAt: new Date().toISOString(),
    units: "meters",
    axes: "Y up, -Z north (three.js / glTF). position = bottom-centre of the box; size = [width X, height Y, depth Z]; rotationY in radians.",
    styleNotes: level.styleNotes,
    prove: level.prove && {
      status: level.prove.status,
      reason: level.prove.reason,
      coveredFraction: level.prove.coveredFraction,
      message: level.prove.message,
    },
    volumes,
  };
  zip.file("level.json", JSON.stringify(json, null, 2));
  zip.file("README.txt", README);
  return zip.generateAsync({ type: "blob" });
}

/** Browser helper: build and download `<level-id>.zip`. */
export async function downloadLevelZip(level: Level): Promise<void> {
  const blob = await buildExportZip(level);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${level.id}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// ---------- internals ----------

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Export: could not fetch ${url} (${r.status})`);
  return r.arrayBuffer();
}

async function measureWithThree(glb: ArrayBuffer, size: [number, number, number]): Promise<AssetTransform> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(glb, "");
  const parent = new Group();
  parent.add(gltf.scene);
  fitToVolume(gltf.scene, size);
  const o = gltf.scene;
  return {
    position: [o.position.x, o.position.y, o.position.z],
    rotationY: o.rotation.y,
    scale: [o.scale.x, o.scale.y, o.scale.z],
  };
}

const README = `PLAYBOUND level export
======================

level.json  - the gameplay contract. One entry per volume:
              position (bottom-centre, meters), rotationY (radians), size [W, H, D], role.
assets/     - Hyper3D Rodin models (GLB) for dressed volumes.

Rule: COLLISION = THE BOX. Create a box collider of 'size' at each volume
(centre = position + [0, size.H / 2, 0], rotated by rotationY). The model is visual only.

Placing a model: create an empty at the volume's position/rotationY, then add the GLB as a
child with asset.transform (position, rotationY, scale). That is exactly what the browser showed.

Axes: Y up, glTF convention (right-handed, -Z forward).
  Unity:  GLB via glTFast; flip Z (z -> -z) and negate rotationY for left-handed space.
  Unreal: glTF importer; 1 m = 100 uu; Y-up -> Z-up (swap Y/Z).
  Godot:  imports glTF natively, same Y-up right-handed axes.
`;
