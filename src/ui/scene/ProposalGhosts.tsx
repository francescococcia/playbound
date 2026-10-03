import { Line } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, type LineSegments } from "three";
import { usePlaybound } from "../../core/store";
import { ROLE_COLORS, type Proposal, type Volume } from "../../core/types";

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
  color,
  dashed = true,
  opacity = 0.42,
}: {
  volume: Pick<Volume, "position" | "size" | "rotationY" | "role">;
  color?: string;
  dashed?: boolean;
  opacity?: number;
}) {
  const [sx, sy, sz] = volume.size;
  const c = color ?? ROLE_COLORS[volume.role] ?? "#58a6ff";
  return (
    <group position={[volume.position[0], volume.position[1], volume.position[2]]} rotation={[0, volume.rotationY, 0]}>
      <mesh position={[0, sy / 2, 0]}>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color={c}
          emissive={c}
          emissiveIntensity={0.25}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      {dashed ? (
        <DashedEdges sx={sx} sy={sy} sz={sz} color="#ffffff" />
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
}: {
  from: Volume;
  to: { position?: [number, number, number]; rotationY?: number; size?: [number, number, number] };
}) {
  const position = to.position ?? from.position;
  const rotationY = to.rotationY ?? from.rotationY;
  const size = to.size ?? from.size;
  const midY = Math.max(size[1], from.size[1]) / 2 + 0.25;
  return (
    <group>
      <GhostBox volume={{ ...from, position, rotationY, size }} color="#79c0ff" opacity={0.4} />
      {to.position &&
        (to.position[0] !== from.position[0] || to.position[2] !== from.position[2]) && (
          <Line
            points={[
              [from.position[0], midY, from.position[2]],
              [position[0], midY, position[2]],
            ]}
            color="#79c0ff"
            lineWidth={3}
            dashed
            dashSize={0.4}
            gapSize={0.2}
          />
        )}
    </group>
  );
}

function ProposalGhostsInner({ proposal, volumes }: { proposal: Proposal; volumes: Volume[] }) {
  const removes = new Set(proposal.remove ?? []);
  return (
    <group>
      {(proposal.add ?? []).map((v) => (
        <GhostBox key={`${proposal.id}-add-${v.id}`} volume={v} />
      ))}
      {(proposal.update ?? []).map((u) => {
        const from = volumes.find((v) => v.id === u.id);
        if (!from) return null;
        return <UpdateGhost key={`${proposal.id}-upd-${u.id}`} from={from} to={u} />;
      })}
      {volumes
        .filter((v) => removes.has(v.id))
        .map((v) => (
          <GhostBox key={`${proposal.id}-rm-${v.id}`} volume={v} color="#f85149" opacity={0.5} dashed={false} />
        ))}
    </group>
  );
}

/** Translucent dashed ghosts for pending AI proposals. */
export function ProposalGhosts() {
  const proposals = usePlaybound((s) => s.proposals);
  const volumes = usePlaybound((s) => s.level.volumes);
  if (proposals.length === 0) return null;
  return (
    <group>
      {proposals.map((p) => (
        <ProposalGhostsInner key={p.id} proposal={p} volumes={volumes} />
      ))}
    </group>
  );
}
