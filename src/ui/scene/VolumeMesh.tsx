import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { usePlaybound } from "../../core/store";
import { ROLE_COLORS, type Volume } from "../../core/types";

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const HIT = new THREE.Vector3();
const NDC = new THREE.Vector2();
const RAYCASTER = new THREE.Raycaster();

function alwaysLabel(role: Volume["role"]) {
  return role === "spawn" || role === "objective" || role === "cover";
}

/** One contract volume. Spawn/objective = flat markers; others = solid boxes. Drag XZ when unlocked. */
export function VolumeMesh({ volume }: { volume: Volume }) {
  const selectedId = usePlaybound((s) => s.selectedId);
  const select = usePlaybound((s) => s.select);
  const updateVolume = usePlaybound((s) => s.updateVolume);
  const locked = usePlaybound((s) => s.level.locked);
  const { controls, camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const dragging = useRef(false);
  const selected = selectedId === volume.id;
  const color = ROLE_COLORS[volume.role];
  const isMarker = volume.role === "spawn" || volume.role === "objective";
  const showLabel = alwaysLabel(volume.role) || selected || hovered;
  const yBase = volume.position[1];

  const setOrbit = (on: boolean) => {
    const c = controls as { enabled?: boolean } | null;
    if (c && "enabled" in c) c.enabled = on;
  };

  const projectGround = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    NDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    NDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    RAYCASTER.setFromCamera(NDC, camera);
    if (!RAYCASTER.ray.intersectPlane(GROUND, HIT)) return null;
    return [HIT.x, yBase, HIT.z] as [number, number, number];
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const pos = projectGround(e.clientX, e.clientY);
      if (pos) updateVolume(volume.id, { position: pos });
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setOrbit(true);
      gl.domElement.style.cursor = hovered ? "grab" : "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag helpers close over latest volume/camera
  }, [volume.id, yBase, camera, gl, updateVolume, hovered, controls]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(volume.id);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (locked) return;
    e.stopPropagation();
    dragging.current = true;
    select(volume.id);
    setOrbit(false);
    gl.domElement.style.cursor = "grabbing";
  };

  const [sx, sy, sz] = volume.size;
  const cx = volume.position[0];
  const cy = volume.position[1] + sy / 2;
  const cz = volume.position[2];

  const label = showLabel ? (
    <Html position={isMarker ? [0, 0.85, 0] : [0, sy / 2 + 0.35, 0]} center style={{ pointerEvents: "none" }}>
      <span className={`vol-label${selected ? " vol-label--selected" : ""}`}>{volume.label}</span>
    </Html>
  ) : null;

  const hoverHandlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(true);
      if (!locked && !dragging.current) gl.domElement.style.cursor = "grab";
    },
    onPointerOut: () => {
      setHovered(false);
      if (!dragging.current) gl.domElement.style.cursor = "";
    },
  };

  if (isMarker) {
    const r = Math.max(sx, sz) / 2;
    const isObjective = volume.role === "objective";
    return (
      <group position={[cx, 0.02, cz]} onClick={onClick} onPointerDown={onPointerDown} {...hoverHandlers}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={isObjective || selected ? color : "#000000"}
            emissiveIntensity={isObjective ? 0.7 : selected ? 0.55 : 0}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[r * 0.82, r, 32]} />
          <meshBasicMaterial color={selected ? "#ffffff" : color} />
        </mesh>

        {isObjective && (
          <group>
            <mesh position={[0, 2.2, 0]}>
              <cylinderGeometry args={[0.08, 0.12, 4.2, 10]} />
              <meshStandardMaterial color="#f2cc60" emissive="#f2cc60" emissiveIntensity={1.2} />
            </mesh>
            <mesh position={[0, 4.5, 0]}>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshStandardMaterial color="#ffe08a" emissive="#f2cc60" emissiveIntensity={2} />
            </mesh>
            <pointLight position={[0, 4.5, 0]} color="#f2cc60" intensity={2.5} distance={14} />
          </group>
        )}

        {label}
      </group>
    );
  }

  return (
    <group
      position={[cx, cy, cz]}
      rotation={[0, volume.rotationY, 0]}
      onClick={onClick}
      onPointerDown={onPointerDown}
      {...hoverHandlers}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color={color}
          emissive={selected || hovered ? color : "#000000"}
          emissiveIntensity={selected ? 0.35 : hovered ? 0.15 : 0}
          transparent
          opacity={0.92}
        />
      </mesh>
      {selected && (
        <mesh>
          <boxGeometry args={[sx + 0.08, sy + 0.08, sz + 0.08]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.7} />
        </mesh>
      )}
      {label}
    </group>
  );
}
