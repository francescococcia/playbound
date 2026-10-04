// Playtest replay (Round 4 · A): after Prove, a bot runs the route. Coral + "Spotted!" when it
// is in the open, green when protected. Ends with a card: "Spotted for X s of Y s".
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, type Group, type MeshStandardMaterial } from "three";
import { create } from "zustand";
import { replayTimeline, sampleReplay, type ReplayTimeline } from "../../core/prove/replay";
import { usePlaybound } from "../../core/store";
import { SCENE, reducedMotion } from "../motion";

/** Replay UI state shared by the 3D bot and the DOM card. */
export const useReplay = create<{
  /** Bumped to (re)start a run. */
  runId: number;
  playing: boolean;
  /** Set when a run finishes. */
  result: { spottedSeconds: number; totalSeconds: number; longestExposedSeconds: number; pass: boolean } | null;
  replay: () => void;
  stop: () => void;
}>((set) => ({
  runId: 0,
  playing: false,
  result: null,
  replay: () => set((s) => ({ runId: s.runId + 1, playing: true, result: null })),
  stop: () => set({ playing: false }),
}));

const START_DELAY_S = 0.9; // let the route draw first
const GREEN = new Color(SCENE.proof);
const CORAL = new Color(SCENE.danger);

export function BotReplay() {
  const prove = usePlaybound((s) => s.level.prove);
  const runId = useReplay((s) => s.runId);
  const playing = useReplay((s) => s.playing);
  const tl = useMemo<ReplayTimeline | null>(() => replayTimeline(prove), [prove]);

  // Every new Prove result starts a fresh run automatically.
  useEffect(() => {
    if (tl && prove?.status !== "idle") useReplay.getState().replay();
    else useReplay.setState({ playing: false, result: null });
  }, [prove?.checkedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tl || !prove || !playing) return null;
  return <Runner key={runId} tl={tl} />;
}

function Runner({ tl }: { tl: ReplayTimeline }) {
  const prove = usePlaybound((s) => s.level.prove)!;
  const grp = useRef<Group>(null);
  const body = useRef<MeshStandardMaterial>(null);
  const ring = useRef<MeshStandardMaterial>(null);
  const t = useRef(reducedMotion() ? tl.totalSeconds : -START_DELAY_S);
  const [spotted, setSpotted] = useState(false);
  const color = useRef(new Color(SCENE.proof));

  useFrame((state, dt) => {
    t.current += dt;
    const time = Math.max(0, t.current);
    const s = sampleReplay(prove, tl, time);
    if (grp.current) {
      grp.current.position.set(s.x, 0, s.z);
      grp.current.rotation.y = s.heading;
      // little running bob
      grp.current.position.y = time > 0 && time < tl.totalSeconds ? Math.abs(Math.sin(time * 12)) * 0.08 : 0;
    }
    color.current.lerp(s.spotted ? CORAL : GREEN, Math.min(1, dt * 10));
    body.current?.color.copy(color.current);
    body.current?.emissive.copy(color.current);
    if (ring.current) ring.current.opacity = s.spotted ? 0.35 + 0.35 * Math.abs(Math.sin(state.clock.elapsedTime * 8)) : 0.25;
    if (s.spotted !== spotted && time > 0) setSpotted(s.spotted);
    if (t.current >= tl.totalSeconds + 0.4 && useReplay.getState().playing) {
      useReplay.setState({
        playing: false,
        result: {
          spottedSeconds: tl.spottedSeconds,
          totalSeconds: tl.totalSeconds,
          longestExposedSeconds: tl.longestExposedSeconds,
          pass: prove.status === "pass",
        },
      });
    }
  });

  return (
    <group ref={grp}>
      {/* body + head: a simple, readable runner (1.8 m tall like the Prove agent) */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.8, 6, 12]} />
        <meshStandardMaterial ref={body} emissiveIntensity={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshStandardMaterial color="#e8edf7" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.45, 0.7, 32]} />
        <meshStandardMaterial ref={ring} color={SCENE.danger} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      {spotted && (
        <Html position={[0, 2.25, 0]} center style={{ pointerEvents: "none" }}>
          <div className="replay-spotted">Spotted!</div>
        </Html>
      )}
    </group>
  );
}
