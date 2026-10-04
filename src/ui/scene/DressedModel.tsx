import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { fitToVolume } from "../../core/dress/fit";
import { easeOut, reducedMotion } from "../motion";

/**
 * Load a meshopt GLB, clone, fit inside the contract box.
 * Parent must sit at the volume's bottom-centre (+ rotationY).
 */
export function DressedModel({
  url,
  size,
}: {
  url: string;
  size: [number, number, number];
}) {
  const gltf = useGLTF(url);
  const [w, h, d] = size;

  const obj = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useLayoutEffect(() => {
    fitToVolume(obj, [w, h, d]);
    obj.traverse((n) => {
      const m = n as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [obj, w, h, d]);

  // Pop in when the model arrives (DESIGN_BRIEF §5): grows from 92% to full size, never past the box.
  const grp = useRef<Group>(null);
  const t = useRef(reducedMotion() ? 1 : 0);
  useFrame((_, dt) => {
    if (!grp.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + dt / 0.35);
    grp.current.scale.setScalar(0.92 + 0.08 * easeOut(t.current));
  });

  return (
    <group ref={grp} scale={t.current >= 1 ? 1 : 0.92}>
      <primitive object={obj} />
    </group>
  );
}
