import { Suspense } from "react";
import { ROLE_COLORS, type Volume } from "../../core/types";
import { SceneBoundary } from "../scene/SceneBoundary";
import { DressedModel } from "../scene/DressedModel";

/** Non-interactive volume for Play mode — no labels, selection, or drag. */
export function PlayVolume({ volume }: { volume: Volume }) {
  const color = ROLE_COLORS[volume.role];
  const [sx, sy, sz] = volume.size;
  const cx = volume.position[0];
  const cz = volume.position[2];
  const isMarker = volume.role === "spawn" || volume.role === "objective";
  const ready = volume.status === "ready" && !!volume.assetUrl;

  if (isMarker) {
    const r = Math.max(sx, sz) / 2;
    const isObjective = volume.role === "objective";
    return (
      <group position={[cx, 0.02, cz]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={isObjective ? color : "#000000"}
            emissiveIntensity={isObjective ? 0.7 : 0}
            transparent
            opacity={0.9}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[r * 0.82, r, 32]} />
          <meshBasicMaterial color={color} />
        </mesh>
        {isObjective && (
          <group>
            <mesh position={[0, 2.2, 0]}>
              <cylinderGeometry args={[0.08, 0.12, 4.2, 10]} />
              <meshStandardMaterial color="#f2c14e" emissive="#f2c14e" emissiveIntensity={1.2} />
            </mesh>
            <mesh position={[0, 4.5, 0]}>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshStandardMaterial color="#ffe08a" emissive="#f2c14e" emissiveIntensity={2} />
            </mesh>
            <pointLight position={[0, 4.5, 0]} color="#f2c14e" intensity={2.5} distance={14} />
          </group>
        )}
      </group>
    );
  }

  return (
    <group position={[cx, volume.position[1], cz]} rotation={[0, volume.rotationY, 0]}>
      {ready ? (
        <Suspense
          fallback={
            <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[sx, sy, sz]} />
              <meshStandardMaterial color={color} transparent opacity={0.85} />
            </mesh>
          }
        >
          <SceneBoundary
            label={volume.label}
            fallback={
              <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[sx, sy, sz]} />
                <meshStandardMaterial color={color} roughness={0.85} metalness={0} transparent opacity={0.9} />
              </mesh>
            }
          >
            <DressedModel url={volume.assetUrl!} size={volume.size} />
          </SceneBoundary>
        </Suspense>
      ) : (
        <mesh position={[0, sy / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0} transparent opacity={0.9} />
        </mesh>
      )}
      {/* Invisible collider proxy kept for picking parity; collision uses contract boxes in resolveCollision */}
      {ready && (
        <mesh position={[0, sy / 2, 0]} visible={false}>
          <boxGeometry args={[sx, sy, sz]} />
        </mesh>
      )}
    </group>
  );
}
