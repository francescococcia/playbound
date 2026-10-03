import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { resolveCollision } from "../../core/geometry";
import type { Level } from "../../core/types";

const SPEED = 4; // m/s
const EYE = 1.6;
const RADIUS = 0.35;
const UP = new Vector3(0, 1, 0);

/**
 * First-person walk. Pointer lock + WASD. Collision shares `resolveCollision`
 * with the Prove bot so walls match.
 */
export function FpsController({ level }: { level: Level }) {
  const { camera, gl } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false });
  const pos = useRef(new Vector3());
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const move = useRef(new Vector3());

  const spawn = level.volumes.find((v) => v.role === "spawn");

  // Drop the player at the spawn whenever FPS mode mounts / preset changes.
  useEffect(() => {
    const x = spawn?.position[0] ?? 0;
    const z = spawn?.position[2] ?? 0;
    pos.current.set(x, EYE, z);
    camera.position.copy(pos.current);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(x, EYE, z - 1);
  }, [camera, spawn?.position[0], spawn?.position[2], level.id]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k as keyof typeof keys.current] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keys.current) keys.current[k as keyof typeof keys.current] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, dt) => {
    const { w, a, s, d } = keys.current;
    if (!(w || a || s || d)) {
      camera.position.y = EYE;
      return;
    }

    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 1e-6) forward.current.set(0, 0, -1);
    else forward.current.normalize();
    right.current.crossVectors(forward.current, UP).normalize();

    move.current.set(0, 0, 0);
    if (w) move.current.add(forward.current);
    if (s) move.current.sub(forward.current);
    if (d) move.current.add(right.current);
    if (a) move.current.sub(right.current);
    if (move.current.lengthSq() > 0) {
      move.current.normalize().multiplyScalar(SPEED * Math.min(dt, 0.05));
      let x = camera.position.x + move.current.x;
      let z = camera.position.z + move.current.z;
      [x, z] = resolveCollision(x, z, RADIUS, level.volumes, level.bounds);
      camera.position.set(x, EYE, z);
    } else {
      camera.position.y = EYE;
    }
  });

  return <PointerLockControls makeDefault domElement={gl.domElement} />;
}
