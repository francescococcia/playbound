import { Line } from "@react-three/drei";
import type { ProveResult } from "../../core/types";

/** Heatmap path: green where covered, red where exposed. */
export function ProvePath({ prove }: { prove: ProveResult | undefined }) {
  const path = prove?.path;
  const covered = prove?.covered;
  if (!path || path.length < 2 || prove?.status === "idle") return null;

  const segments: { points: [number, number, number][]; ok: boolean }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const ok = covered?.[i] ?? false;
    const last = segments[segments.length - 1];
    if (last && last.ok === ok) {
      last.points.push([b[0], 0.08, b[2]]);
    } else {
      segments.push({
        ok,
        points: [
          [a[0], 0.08, a[2]],
          [b[0], 0.08, b[2]],
        ],
      });
    }
  }

  return (
    <group>
      {segments.map((seg, i) => (
        <Line
          key={i}
          points={seg.points}
          color={seg.ok ? "#3fb950" : "#f85149"}
          lineWidth={4}
          transparent
          opacity={0.95}
        />
      ))}
    </group>
  );
}
