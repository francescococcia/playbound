import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import { usePlaybound } from "../../core/store";
import { StepActionBar } from "../panels/StepActionBar";
import { ViewportChrome } from "../panels/ViewportChrome";
import { useUiPrefs } from "../uiPrefs";
import { groundUnderCamera, setViewGroundPicker } from "../viewPick";
import { isGreybox } from "../workflow";
import { FpsController } from "./FpsController";
import { Ground } from "./Ground";
import { Heatmap } from "./Heatmap";
import { ProveResultCard } from "../panels/ProveResultCard";
import { ReplayCard } from "../panels/ReplayCard";
import { BotReplay } from "./BotReplay";
import { ProvePath } from "./ProvePath";
import { ProposalGhosts } from "./ProposalGhosts";
import { VolumeMesh } from "./VolumeMesh";

/** High 3/4 overview: whole square, gate → corridor → well. */
const ORBIT_POS: [number, number, number] = [8, 48, 36];
const ORBIT_TARGET: [number, number, number] = [0, 0, 0];

function ViewPicker() {
  const { camera } = useThree();
  useEffect(() => {
    setViewGroundPicker(() => groundUnderCamera(camera));
    return () => setViewGroundPicker(() => [0, 0, 0]);
  }, [camera]);
  return null;
}

function OrbitRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...ORBIT_POS);
    camera.lookAt(...ORBIT_TARGET);
  }, [camera]);
  return (
    <OrbitControls
      makeDefault
      target={ORBIT_TARGET}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={12}
      maxDistance={90}
    />
  );
}

export function Viewport() {
  const level = usePlaybound((s) => s.level);
  const viewMode = usePlaybound((s) => s.viewMode);
  const select = usePlaybound((s) => s.select);
  const replacingLayout = usePlaybound((s) => s.proposals.some((p) => p.replaceAll));
  const showHeatmap = useUiPrefs((s) => s.showHeatmap);
  const prove = level.prove;
  const blueprint = isGreybox(level);
  const showLegend =
    showHeatmap &&
    viewMode === "orbit" &&
    prove &&
    prove.status !== "idle" &&
    !!prove.exposure?.length;

  const bg = blueprint ? "#0E1320" : "#87a0b8";

  return (
    <main className="viewport">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: ORBIT_POS, fov: 45, near: 0.1, far: 250 }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[bg, blueprint ? 70 : 55, blueprint ? 140 : 120]} />
        <ambientLight intensity={blueprint ? 0.45 : 0.35} />
        <directionalLight
          castShadow
          position={[22, 40, 14]}
          intensity={blueprint ? 1.1 : 1.35}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={90}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
        />
        <ViewPicker />
        <Suspense fallback={null}>
          {!blueprint && <Environment preset="city" environmentIntensity={0.55} />}
          <Ground bounds={level.bounds} blueprint={blueprint} />
          <Heatmap />
          {level.volumes.map((v) => (
            <VolumeMesh key={v.id} volume={v} faded={replacingLayout} />
          ))}
          <ProposalGhosts />
          {viewMode === "orbit" && <ProvePath prove={level.prove} />}
          {viewMode === "orbit" && <BotReplay />}
        </Suspense>

        {viewMode === "orbit" ? <OrbitRig /> : <FpsController level={level} />}
      </Canvas>

      <ProveResultCard />
      <ReplayCard />
      <ViewportChrome />
      <StepActionBar />

      {showLegend && (
        <div className="heatmap-legend" aria-hidden>
          <span className="heatmap-swatch heatmap-swatch--seen" />
          Red = seen by defenders
          <span className="heatmap-swatch heatmap-swatch--hidden" />
          Blue = hidden
        </div>
      )}

      {viewMode === "fps" && (
        <div className="viewport-hint">Click to lock pointer · WASD move · Esc unlock</div>
      )}
    </main>
  );
}
