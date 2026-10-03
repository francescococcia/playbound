import { Html } from "@react-three/drei";
import { usePlaybound } from "../../core/store";
import { ROLE_COLORS, type Volume } from "../../core/types";
import type { ThreeEvent } from "@react-three/fiber";

/** One contract volume. Spawn/objective = flat markers; others = solid boxes. */
export function VolumeMesh({ volume }: { volume: Volume }) {
  const selectedId = usePlaybound((s) => s.selectedId);
  const select = usePlaybound((s) => s.select);
  const selected = selectedId === volume.id;
  const color = ROLE_COLORS[volume.role];
  const isMarker = volume.role === "spawn" || volume.role === "objective";

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(volume.id);
  };

  // position = bottom-centre → mesh centre y = size[1] / 2
  const [sx, sy, sz] = volume.size;
  const cx = volume.position[0];
  const cy = volume.position[1] + sy / 2;
  const cz = volume.position[2];

  if (isMarker) {
    const r = Math.max(sx, sz) / 2;
    return (
      <group position={[cx, 0.02, cz]} onClick={onClick}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={selected ? color : "#000000"}
            emissiveIntensity={selected ? 0.55 : 0}
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[r * 0.85, r, 32]} />
          <meshBasicMaterial color={selected ? "#ffffff" : color} />
        </mesh>
        <Html position={[0, 0.6, 0]} center distanceFactor={28} style={{ pointerEvents: "none" }}>
          <span className={`vol-label${selected ? " vol-label--selected" : ""}`}>{volume.label}</span>
        </Html>
      </group>
    );
  }

  return (
    <group position={[cx, cy, cz]} rotation={[0, volume.rotationY, 0]} onClick={onClick}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.35 : 0}
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
      <Html position={[0, sy / 2 + 0.4, 0]} center distanceFactor={28} style={{ pointerEvents: "none" }}>
        <span className={`vol-label${selected ? " vol-label--selected" : ""}`}>{volume.label}</span>
      </Html>
    </group>
  );
}
