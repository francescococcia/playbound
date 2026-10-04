import { Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorUrlFromPlay } from "../../core/share";
import { usePlaybound } from "../../core/store";
import { FpsController } from "../scene/FpsController";
import { Ground } from "../scene/Ground";
import { isGreybox } from "../workflow";
import { PlayVolume } from "./PlayVolume";
import "./play.css";

const WIN_RADIUS = 2;
const ORBIT_POS: [number, number, number] = [8, 48, 36];

type Phase = "start" | "playing" | "won";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  // Only block phones/tablets: touchscreen laptops also report touch points but have a mouse.
  return !window.matchMedia("(any-pointer: fine)").matches;
}

function PlayWatcher({
  objective,
  active,
  onHud,
  onWin,
}: {
  objective: [number, number, number] | null;
  active: boolean;
  onHud: (elapsed: number, dist: number) => void;
  onWin: (elapsed: number) => void;
}) {
  const { camera, gl } = useThree();
  const t0 = useRef<number | null>(null);
  const lastHud = useRef(0);
  const won = useRef(false);

  useEffect(() => {
    if (!active) {
      t0.current = null;
      won.current = false;
      return;
    }
    t0.current = performance.now();
    won.current = false;
  }, [active]);

  useFrame(() => {
    if (!active || !objective || won.current) return;
    if (t0.current == null) t0.current = performance.now();
    const elapsed = (performance.now() - t0.current) / 1000;
    const dx = camera.position.x - objective[0];
    const dz = camera.position.z - objective[2];
    const dist = Math.hypot(dx, dz);

    const now = performance.now();
    if (now - lastHud.current > 80) {
      lastHud.current = now;
      onHud(elapsed, dist);
    }

    if (dist <= WIN_RADIUS) {
      won.current = true;
      document.exitPointerLock?.();
      gl.domElement.ownerDocument.exitPointerLock?.();
      onWin(elapsed);
    }
  });

  return null;
}

function LockOnDemand({ enabled }: { enabled: boolean }) {
  const { gl } = useThree();
  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const tryLock = () => {
      if (document.pointerLockElement !== el) {
        el.requestPointerLock?.();
      }
    };
    // Play button already clicked — lock as soon as the canvas is ready.
    tryLock();
    const id = window.setTimeout(tryLock, 50);
    return () => window.clearTimeout(id);
  }, [enabled, gl]);
  return null;
}

export function PlayMode() {
  const level = usePlaybound((s) => s.level);
  const [phase, setPhase] = useState<Phase>("start");
  const [elapsed, setElapsed] = useState(0);
  const [dist, setDist] = useState(Infinity); // "Find the gold beacon" until the first frame
  const [winTime, setWinTime] = useState(0);
  const [runId, setRunId] = useState(0);
  const [touch] = useState(() => isTouchDevice());

  const blueprint = isGreybox(level);
  const objective = useMemo(() => {
    const o = level.volumes.find((v) => v.role === "objective");
    return o ? o.position : null;
  }, [level.volumes]);

  const editorHref = editorUrlFromPlay();
  const homeHref = `${location.origin}${location.pathname}`;

  const onHud = useCallback((e: number, d: number) => {
    setElapsed(e);
    setDist(d);
  }, []);

  const onWin = useCallback((e: number) => {
    setWinTime(e);
    setPhase("won");
  }, []);

  const startPlay = () => {
    setElapsed(0);
    setDist(Infinity);
    setPhase("playing");
    setRunId((n) => n + 1);
  };

  const playAgain = () => {
    setWinTime(0);
    setElapsed(0);
    setDist(Infinity);
    setPhase("playing");
    setRunId((n) => n + 1);
  };

  if (touch) {
    return (
      <div className="play-mode">
        <div className="play-overlay">
          <div className="play-card">
            <p className="play-brand">PLAYBOUND</p>
            <h1 className="play-title">{level.name}</h1>
            <p className="play-lead">Play on a computer with a keyboard</p>
            <p className="play-controls">This game uses WASD and mouse look (pointer lock).</p>
            <div className="play-actions">
              <a className="play-btn play-btn--ghost" href={editorHref}>
                Open in editor
              </a>
              <a className="play-btn play-btn--ghost" href={homeHref}>
                Make your own
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bg = blueprint ? "#0E1320" : "#87a0b8";

  return (
    <div className="play-mode">
      <Canvas
        key={runId}
        shadows
        camera={{ position: ORBIT_POS, fov: 70, near: 0.1, far: 250 }}
      >
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, blueprint ? 70 : 55, blueprint ? 140 : 120]} />
        <ambientLight intensity={blueprint ? 0.45 : 0.35} />
        <directionalLight
          castShadow
          position={[22, 40, 14]}
          intensity={blueprint ? 1.1 : 1.35}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={90}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
        />
        <Suspense fallback={null}>
          {!blueprint && <Environment preset="city" environmentIntensity={0.55} />}
          <Ground bounds={level.bounds} blueprint={blueprint} />
          {level.volumes.map((v) => (
            <PlayVolume key={v.id} volume={v} />
          ))}
        </Suspense>
        {(phase === "playing" || phase === "won") && (
          <>
            <FpsController key={`fps-${runId}`} level={level} />
            {phase === "playing" && <LockOnDemand enabled />}
            <PlayWatcher
              key={`watch-${runId}`}
              objective={objective}
              active={phase === "playing"}
              onHud={onHud}
              onWin={onWin}
            />
          </>
        )}
      </Canvas>

      {phase === "playing" && (
        <div className="play-hud" aria-live="polite">
          <div className="play-hud-brand">PLAYBOUND</div>
          <div className="play-hud-stats">
            <span className="play-hud-timer">{formatTime(elapsed)}</span>
            <span className="play-hud-dist">
              {dist < 100 ? `${dist.toFixed(1)} m to beacon` : "Find the gold beacon"}
            </span>
          </div>
          <div className="play-hint">WASD move · mouse look · Esc unlock</div>
        </div>
      )}

      {phase === "start" && (
        <div className="play-overlay">
          <div className="play-card">
            <p className="play-brand">PLAYBOUND</p>
            <h1 className="play-title">{level.name}</h1>
            <p className="play-lead">Reach the gold beacon</p>
            <p className="play-controls">
              <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move · mouse look · <kbd>Esc</kbd>{" "}
              unlock pointer
            </p>
            <button type="button" className="play-btn" onClick={startPlay}>
              Play
            </button>
          </div>
        </div>
      )}

      {phase === "won" && (
        <div className="play-overlay">
          <div className="play-card">
            <p className="play-brand">PLAYBOUND</p>
            <h1 className="play-title">Objective reached</h1>
            <p className="play-time">{formatTime(winTime)}</p>
            <p className="play-controls">You made it to the gold beacon.</p>
            <div className="play-actions">
              <button type="button" className="play-btn" onClick={playAgain}>
                Play again
              </button>
              <a className="play-btn play-btn--ghost" href={editorHref}>
                Open in editor
              </a>
              <a className="play-btn play-btn--ghost" href={homeHref}>
                Make your own
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
