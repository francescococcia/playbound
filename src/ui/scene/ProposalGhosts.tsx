import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, type LineSegments, type MeshStandardMaterial } from "three";
import { usePlaybound } from "../../core/store";
import type { Proposal, Volume } from "../../core/types";
import { SCENE, reducedMotion } from "../motion";

/** How a proposal is shown: normal pulse, focused (being previewed), or dimmed (another is previewed). */
type Emphasis = "normal" | "focus" | "dim";
const LEVEL: Record<Emphasis, number> = { normal: 1, focus: 1.6, dim: 0.3 };

function DashedEdges({ sx, sy, sz, color }: { sx: number; sy: number; sz: number; color: string }) {
  const ref = useRef<LineSegments>(null);
  const geo = useMemo(() => new BoxGeometry(sx, sy, sz), [sx, sy, sz]);
  useLayoutEffect(() => {
    ref.current?.computeLineDistances();
  }, [sx, sy, sz]);
  return (
    <lineSegments ref={ref} position={[0, sy / 2, 0]}>
      <edgesGeometry args={[geo]} />
      <lineDashedMaterial color={color} dashSize={0.45} gapSize={0.18} transparent opacity={1} />
    </lineSegments>
  );
}

function GhostBox({
  volume,
  color = SCENE.ai,
  dashed = true,
  opacity = 0.34,
  emphasis = "normal",
}: {
  volume: Pick<Volume, "position" | "size" | "rotationY" | "role">;
  color?: string;
  dashed?: boolean;
  opacity?: number;
  emphasis?: Emphasis;
}) {
  const [sx, sy, sz] = volume.size;
  const c = color;
  // Soft violet pulse until accepted (DESIGN_BRIEF §5); scale-in on appear.
  const mat = useRef<MeshStandardMaterial>(null);
  const grp = useRef<import("three").Group>(null);
  const born = useRef(reducedMotion() ? -10 : 0);
  useFrame((state, dt) => {
    born.current += dt;
    const k = LEVEL[emphasis];
    const pulse = reducedMotion() ? 1 : 0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 3);
    if (mat.current) mat.current.opacity = Math.min(0.85, opacity * k * pulse);
    if (grp.current) {
      const s = born.current >= 0.25 ? 1 : 0.9 + 0.1 * (born.current / 0.25);
      grp.current.scale.setScalar(s);
    }
  });
  return (
    <group ref={grp} position={[volume.position[0], volume.position[1], volume.position[2]]} rotation={[0, volume.rotationY, 0]}>
      <mesh position={[0, sy / 2, 0]}>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          ref={mat}
          color={c}
          emissive={c}
          emissiveIntensity={emphasis === "focus" ? 0.6 : 0.3}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      {dashed ? (
        <DashedEdges sx={sx} sy={sy} sz={sz} color={emphasis === "dim" ? "#6b5c99" : "#e9e2ff"} />
      ) : (
        <mesh position={[0, sy / 2, 0]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshBasicMaterial color={c} wireframe transparent opacity={0.95} />
        </mesh>
      )}
    </group>
  );
}

function UpdateGhost({
  from,
  to,
  emphasis,
}: {
  from: Volume;
  to: { position?: [number, number, number]; rotationY?: number; size?: [number, number, number] };
  emphasis: Emphasis;
}) {
  const position = to.position ?? from.position;
  const rotationY = to.rotationY ?? from.rotationY;
  const size = to.size ?? from.size;
  const midY = Math.max(size[1], from.size[1]) / 2 + 0.25;
  return (
    <group>
      <GhostBox volume={{ ...from, position, rotationY, size }} emphasis={emphasis} />
      {to.position &&
        (to.position[0] !== from.position[0] || to.position[2] !== from.position[2]) && (
          <Line
            points={[
              [from.position[0], midY, from.position[2]],
              [position[0], midY, position[2]],
            ]}
            color={SCENE.ai}
            lineWidth={emphasis === "dim" ? 1.5 : 3}
            dashed
            dashSize={0.4}
            gapSize={0.2}
          />
        )}
    </group>
  );
}

function ProposalGhostsInner({ proposal, volumes, emphasis }: { proposal: Proposal; volumes: Volume[]; emphasis: Emphasis }) {
  const removes = new Set(proposal.remove ?? []);
  return (
    <group>
      {(proposal.add ?? []).map((v) => (
        <GhostBox key={`${proposal.id}-add-${v.id}`} volume={v} emphasis={emphasis} />
      ))}
      {(proposal.update ?? []).map((u) => {
        const from = volumes.find((v) => v.id === u.id);
        if (!from) return null;
        return <UpdateGhost key={`${proposal.id}-upd-${u.id}`} from={from} to={u} emphasis={emphasis} />;
      })}
      {volumes
        .filter((v) => removes.has(v.id))
        .map((v) => (
          <GhostBox key={`${proposal.id}-rm-${v.id}`} volume={v} color={SCENE.danger} opacity={0.45} dashed={false} emphasis={emphasis} />
        ))}
    </group>
  );
}

/** Translucent dashed ghosts for pending AI proposals. */
export function ProposalGhosts() {
  const proposals = usePlaybound((s) => s.proposals);
  const volumes = usePlaybound((s) => s.level.volumes);
  const hl = usePlaybound((s) => s.highlightedProposalId);
  if (proposals.length === 0) return null;
  return (
    <group>
      {proposals.map((p) => (
        <ProposalGhostsInner key={p.id} proposal={p} volumes={volumes} emphasis={!hl ? "normal" : hl === p.id ? "focus" : "dim"} />
      ))}
    </group>
  );
}
