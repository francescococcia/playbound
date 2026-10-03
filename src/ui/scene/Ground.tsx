import type { Level } from "../../core/types";

/** 40×40 m floor (bounds×2) plus a low town-wall ring on the edge. */
export function Ground({ bounds }: { bounds: Level["bounds"] }) {
  const size = bounds * 2;
  const wallH = 1.2;
  const wallT = 0.4;
  const half = bounds;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#1c2128" />
      </mesh>

      {/* Edge walls — four segments just inside the play bounds */}
      <mesh position={[0, wallH / 2, -half + wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[size, wallH, wallT]} />
        <meshStandardMaterial color="#30363d" />
      </mesh>
      <mesh position={[0, wallH / 2, half - wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[size, wallH, wallT]} />
        <meshStandardMaterial color="#30363d" />
      </mesh>
      <mesh position={[-half + wallT / 2, wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallT, wallH, size]} />
        <meshStandardMaterial color="#30363d" />
      </mesh>
      <mesh position={[half - wallT / 2, wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallT, wallH, size]} />
        <meshStandardMaterial color="#30363d" />
      </mesh>
    </group>
  );
}
