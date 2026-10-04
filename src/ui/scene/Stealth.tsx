// Walk / Play as a stealth playtest (Round 5): where you stand, are the goal's defenders able
// to see you? Same rule as Prove (src/core/prove/stealth.ts). The probe lives in the canvas,
// the HUD is DOM. Red screen edges when seen.
import { useFrame, useThree } from "@react-three/fiber";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useEffect, useMemo } from "react";
import { prove } from "../../core/prove/prove";
import { stealthAt, useStealth } from "../../core/prove/stealth";
import type { Level } from "../../core/types";
import "./stealth.css";

/** Inside <Canvas>: samples the camera position every frame. `counting` adds up time seen. */
export function StealthProbe({ level, counting = false }: { level: Level; counting?: boolean }) {
  const { camera } = useThree();
  // Use the last Prove when it is current; otherwise compute one (play links, edited levels).
  const result = useMemo(() => (level.prove?.exposure && level.prove.status !== "idle" ? level.prove : prove(level)), [level]);
  useEffect(() => {
    useStealth.getState().reset();
    return () => useStealth.getState().reset();
  }, [result]);
  useFrame((_, dt) => {
    const s = stealthAt(level, result, camera.position.x, camera.position.z);
    const st = useStealth.getState();
    if (s !== st.state) useStealth.setState({ state: s });
    if (counting && s === "seen") useStealth.setState({ seenSeconds: st.seenSeconds + dt });
  });
  return null;
}

const LABEL = { hidden: "Hidden", cover: "In cover", seen: "Seen by defenders" } as const;
const HINT = { hidden: "Out of the goal's line of sight", cover: "Cover within 2.5 m", seen: "The goal can see you: find cover" } as const;
const ICON = { hidden: EyeOff, cover: Shield, seen: Eye } as const;

/** DOM overlay: a status pill + red edges when seen. */
export function StealthHud() {
  const state = useStealth((s) => s.state);
  if (!state) return null;
  return (
    <>
      <div className={`stealth-vignette${state === "seen" ? " stealth-vignette--on" : ""}`} aria-hidden />
      <div className={`stealth-pill stealth-pill--${state}`} role="status" aria-live="polite">
        {/* keyed: the badge pops on each state change */}
        <span key={state} className="stealth-badge" aria-hidden>
          {(() => {
            const I = ICON[state];
            return <I size={15} strokeWidth={2} />;
          })()}
        </span>
        <span className="stealth-text">
          <strong>{LABEL[state]}</strong>
          <span className="stealth-hint">{HINT[state]}</span>
        </span>
      </div>
    </>
  );
}
