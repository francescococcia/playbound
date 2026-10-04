import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { usePlaybound } from "../../core/store";
import { reducedMotion } from "../motion";
import { useUiPrefs } from "../uiPrefs";

/** Ground-plane exposure heatmap: red = seen from objective, blue = hidden. */
export function Heatmap() {
  const prove = usePlaybound((s) => s.level.prove);
  const show = useUiPrefs((s) => s.showHeatmap);

  const exposure = prove?.exposure;
  const cols = prove?.exposureCols;
  const cell = prove?.exposureCell;
  const checkedAt = prove?.checkedAt;
  const ready = Boolean(show && prove && prove.status !== "idle" && exposure && cols && cell);

  const texture = useMemo(() => {
    if (!ready || !exposure || !cols) return null;
    const data = new Uint8Array(cols * cols * 4);
    for (let row = 0; row < cols; row++) {
      // Flip so row 0 (z = −bounds, north) maps to the top of the texture.
      const texRow = cols - 1 - row;
      for (let col = 0; col < cols; col++) {
        const v = exposure[row * cols + col] ?? -1;
        const o = (texRow * cols + col) * 4;
        if (v < 0) {
          data[o + 3] = 0;
        } else if (v >= 0.5) {
          data[o] = 248;
          data[o + 1] = 81;
          data[o + 2] = 73;
          data[o + 3] = 150;
        } else {
          data[o] = 88;
          data[o + 1] = 166;
          data[o + 2] = 255;
          data[o + 3] = 130;
        }
      }
    }
    const tex = new THREE.DataTexture(data, cols, cols, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    tex.flipY = false;
    return tex;
  }, [ready, exposure, cols, checkedAt]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Fade in after the route has started drawing (DESIGN_BRIEF §5).
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  // Over a map / satellite floor, keep the heatmap see-through so the streets stay readable.
  const maxOpacity = usePlaybound((s) => (s.level.ground?.imageUrl ? 0.5 : 1));
  const age = useRef(0);
  useEffect(() => {
    age.current = reducedMotion() ? 10 : 0;
  }, [checkedAt, show]);
  useFrame((_, dt) => {
    if (!mat.current || age.current > 1.2) return;
    age.current += dt;
    mat.current.opacity = maxOpacity * Math.min(1, Math.max(0, (age.current - 0.35) / 0.5));
  });

  if (!ready || !texture || !cols || !cell) return null;

  const size = cols * cell;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial ref={mat} map={texture} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
