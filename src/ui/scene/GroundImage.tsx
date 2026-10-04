// The map / satellite image the layout was read from, laid on the floor at real scale
// (Round 5). Boxes were placed in the same metres, so roads, lawns and trees line up.
// Only the part inside the play area is drawn. North (image top) = -Z.
import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { SRGBColorSpace } from "three";
import type { GroundImage as Ground } from "../../core/types";

export function GroundImage({ ground, bounds, dim = false }: { ground?: Ground; bounds: number; dim?: boolean }) {
  if (!ground?.imageUrl) return null;
  return <Plane ground={ground} bounds={bounds} dim={dim} />;
}

function Plane({ ground, bounds, dim }: { ground: Ground; bounds: number; dim: boolean }) {
  const source = useTexture(ground.imageUrl);
  const w = Math.min(ground.width, bounds * 2);
  const d = Math.min(ground.depth, bounds * 2);
  const tex = useMemo(() => {
    const t = source.clone();
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    // Crop to the centre: show w × d metres out of width × depth.
    t.repeat.set(w / ground.width, d / ground.depth);
    t.offset.set((1 - w / ground.width) / 2, (1 - d / ground.depth) / 2);
    t.needsUpdate = true;
    return t;
  }, [source, w, d, ground.width, ground.depth]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} receiveShadow renderOrder={0}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={tex} roughness={0.95} transparent={dim} opacity={dim ? 0.55 : 1} depthWrite={!dim} />
    </mesh>
  );
}
