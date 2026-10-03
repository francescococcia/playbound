import { Grid } from "@react-three/drei";
import type { Level } from "../../core/types";

/** Mid-grey floor + 1 m grid (stronger every 5 m) + low town-wall ring. */
export function Ground({ bounds }: { bounds: Level["bounds"] }) {
  const size = bounds * 2;
  const wallH = 1.2;
  const wallT = 0.4;
  const half = bounds;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#6e7681" roughness={0.95} metalness={0} />
      </mesh>

      <Grid
        position={[0, 0.01, 0]}
        args={[size, size]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#4d5560"
        sectionSize={5}
        sectionThickness={1.25}
        sectionColor="#2f363d"
        fadeDistance={90}
        fadeStrength={0.6}
        infiniteGrid={false}
      />

      <mesh position={[0, wallH / 2, -half + wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[size, wallH, wallT]} />
        <meshStandardMaterial color="#484f58" />
      </mesh>
      <mesh position={[0, wallH / 2, half - wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[size, wallH, wallT]} />
        <meshStandardMaterial color="#484f58" />
      </mesh>
      <mesh position={[-half + wallT / 2, wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallT, wallH, size]} />
        <meshStandardMaterial color="#484f58" />
      </mesh>
      <mesh position={[half - wallT / 2, wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallT, wallH, size]} />
        <meshStandardMaterial color="#484f58" />
      </mesh>
    </group>
  );
}
