import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { usePlaybound } from "../../core/store";
import { ROLE_COLORS, type Volume } from "../../core/types";
import { shortLabel } from "../label";
import { useUiPrefs } from "../uiPrefs";
import { DressedModel } from "./DressedModel";

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const HIT = new THREE.Vector3();
const NDC = new THREE.Vector2();
const RAYCASTER = new THREE.Raycaster();
/** Pointer must move this far before a drag starts (keeps click = select). */
const DRAG_THRESHOLD_PX = 5;

function alwaysLabel(role: Volume["role"]) {
  return role === "spawn" || role === "objective" || role === "cover";
}

function WireCollider({ size, color }: { size: [number, number, number]; color: string }) {
  const [sx, sy, sz] = size;
  return (
    <mesh position={[0, sy / 2, 0]}>
      <boxGeometry args={[sx, sy, sz]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
    </mesh>
  );
}

function GreyBox({
  size,
  color,
  selected,
  hovered,
}: {
  size: [number, number, number];
  color: string;
  selected: boolean;
  hovered: boolean;
}) {
  const [sx, sy, sz] = size;
  return (
    <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial
        color={color}
        emissive={selected || hovered ? color : "#000000"}
        emissiveIntensity={selected ? 0.35 : hovered ? 0.15 : 0}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

/** One contract volume. Spawn/objective = flat markers; others = solid boxes / dressed GLBs. */
export function VolumeMesh({ volume }: { volume: Volume }) {
  const selectedId = usePlaybound((s) => s.selectedId);
  const select = usePlaybound((s) => s.select);
  const updateVolume = usePlaybound((s) => s.updateVolume);
  const locked = usePlaybound((s) => s.level.locked);
  const viewMode = usePlaybound((s) => s.viewMode);
  const showColliders = useUiPrefs((s) => s.showColliders);
  const { controls, camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const selected = selectedId === volume.id;
  const color = ROLE_COLORS[volume.role];
  const isMarker = volume.role === "spawn" || volume.role === "objective";
  // FPS: only the objective label (clean corridor shot). Orbit: spawn/objective/cover + hover/select.
  const showLabel =
    viewMode === "fps"
      ? volume.role === "objective"
      : alwaysLabel(volume.role) || selected || hovered;
  const yBase = volume.position[1];
  const hasAsset = Boolean(volume.assetUrl);
  const loading = volume.status === "queued" || volume.status === "generating";

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
      if (pending.current && !dragging.current) {
        const dx = e.clientX - pending.current.x;
        const dy = e.clientY - pending.current.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          dragging.current = true;
          didDrag.current = true;
          setOrbit(false);
          gl.domElement.style.cursor = "grabbing";
        }
      }
      if (!dragging.current) return;
      const pos = projectGround(e.clientX, e.clientY);
      if (pos) updateVolume(volume.id, { position: pos });
    };
    const onUp = () => {
      pending.current = null;
      if (dragging.current) {
        dragging.current = false;
        setOrbit(true);
        gl.domElement.style.cursor = hovered ? "grab" : "";
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [volume.id, yBase, camera, gl, updateVolume, hovered, controls]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    select(volume.id);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (locked) return;
    e.stopPropagation();
    didDrag.current = false;
    pending.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    select(volume.id);
  };

  const [sx, sy, sz] = volume.size;
  const cx = volume.position[0];
  const cz = volume.position[2];
  const display = shortLabel(volume.label);

  const label = showLabel ? (
    <Html position={[0, sy + 0.35, 0]} center style={{ pointerEvents: "none" }}>
      <span
        className={`vol-label${selected ? " vol-label--selected" : ""}`}
        style={{ borderColor: selected ? undefined : color }}
      >
        {display}
      </span>
    </Html>
  ) : null;

  const loadBadge = loading ? (
    <Html position={[0, sy / 2, 0]} center style={{ pointerEvents: "none" }}>
      <span className="vol-loading">
        <span className="btn-spin" aria-hidden />
        {volume.stage ?? (volume.status === "queued" ? "Queued" : "Loading…")}
      </span>
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
        {showLabel && (
          <Html position={[0, 0.85, 0]} center style={{ pointerEvents: "none" }}>
            <span
              className={`vol-label${selected ? " vol-label--selected" : ""}`}
              style={{ borderColor: selected ? undefined : color }}
            >
              {display}
            </span>
          </Html>
        )}
      </group>
    );
  }

  return (
    <group
      position={[cx, yBase, cz]}
      rotation={[0, volume.rotationY, 0]}
      onClick={onClick}
      onPointerDown={onPointerDown}
      {...hoverHandlers}
    >
      {hasAsset ? (
        <Suspense
          fallback={
            <>
              <GreyBox size={volume.size} color={color} selected={selected} hovered={hovered} />
              <Html position={[0, sy / 2, 0]} center style={{ pointerEvents: "none" }}>
                <span className="vol-loading">
                  <span className="btn-spin" aria-hidden />
                  Loading model…
                </span>
              </Html>
            </>
          }
        >
          <DressedModel url={volume.assetUrl!} size={volume.size} />
        </Suspense>
      ) : (
        <GreyBox size={volume.size} color={color} selected={selected} hovered={hovered} />
      )}

      {hasAsset && (
        <mesh position={[0, sy / 2, 0]} visible={false}>
          <boxGeometry args={[sx, sy, sz]} />
        </mesh>
      )}

      {(showColliders || selected) && <WireCollider size={volume.size} color={selected ? "#ffffff" : "#58a6ff"} />}

      {loading && loadBadge}
      {label}
    </group>
  );
}
