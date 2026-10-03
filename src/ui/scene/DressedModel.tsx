import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import type { Mesh } from "three";
import { fitToVolume } from "../../core/dress/fit";

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

  return <primitive object={obj} />;
}
