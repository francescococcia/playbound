import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProveResult } from "../../core/types";
import { SCENE, easeOut, reducedMotion } from "../motion";

const DRAW_SECONDS = 0.7;

/**
 * The bot's route: green where protected, coral where exposed. It draws itself from the
 * spawn to the objective each time Prove runs (DESIGN_BRIEF §5).
 */
export function ProvePath({ prove }: { prove: ProveResult | undefined }) {
  const path = prove?.path;
  const covered = prove?.covered;
  const [progress, setProgress] = useState(1);
  const t = useRef(1);

  // Restart the draw-in on every new Prove result.
  useEffect(() => {
    t.current = reducedMotion() ? 1 : 0;
    setProgress(t.current);
  }, [prove?.checkedAt]);

  useFrame((_, dt) => {
    if (t.current >= 1) return;
    t.current = Math.min(1, t.current + dt / DRAW_SECONDS);
    setProgress(easeOut(t.current));
  });

  // Cumulative length per point, to cut the route at `progress`.
  const lengths = useMemo(() => {
    if (!path) return [];
    const out = [0];
    for (let i = 1; i < path.length; i++) out.push(out[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]));
    return out;
  }, [path]);

  if (!path || path.length < 2 || prove?.status === "idle") return null;

  const cut = (lengths[lengths.length - 1] ?? 0) * progress;
  const segments: { points: [number, number, number][]; ok: boolean }[] = [];
  for (let i = 0; i < path.length - 1 && lengths[i] < cut; i++) {
    const a = path[i];
    let b = path[i + 1];
    if (lengths[i + 1] > cut) {
      const f = (cut - lengths[i]) / Math.max(lengths[i + 1] - lengths[i], 1e-6);
      b = [a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f];
    }
    const ok = covered?.[i] ?? false;
    const last = segments[segments.length - 1];
    if (last && last.ok === ok) last.points.push([b[0], 0.08, b[2]]);
    else segments.push({ ok, points: [[a[0], 0.08, a[2]], [b[0], 0.08, b[2]]] });
  }

  return (
    <group>
      {segments.map((seg, i) =>
        seg.points.length > 1 ? (
          <Line key={i} points={seg.points} color={seg.ok ? SCENE.proof : SCENE.danger} lineWidth={4} transparent opacity={0.95} />
        ) : null,
      )}
    </group>
  );
}
