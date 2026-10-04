import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { SceneBoundary, SKY_HDR } from "./SceneBoundary";
import { Suspense, useEffect } from "react";
import { usePlaybound } from "../../core/store";
import { StepActionBar } from "../panels/StepActionBar";
import { ViewportChrome } from "../panels/ViewportChrome";
import { useUiPrefs } from "../uiPrefs";
import { groundUnderCamera, setViewGroundPicker } from "../viewPick";
import { isGreybox } from "../workflow";
import { FpsController } from "./FpsController";
import { Ground } from "./Ground";
import { GroundImage } from "./GroundImage";
import { StealthHud, StealthProbe } from "./Stealth";
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

function OrbitRig({ bounds }: { bounds: number }) {
  const { camera } = useThree();
  const scale = bounds / 20;
  useEffect(() => {
    camera.position.set(ORBIT_POS[0] * scale, ORBIT_POS[1] * scale, ORBIT_POS[2] * scale);
    camera.lookAt(...ORBIT_TARGET);
  }, [bounds, camera, scale]);
  return (
    <OrbitControls
      makeDefault
      target={ORBIT_TARGET}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={12}
      maxDistance={90 * scale}
    />
  );
}

export function Viewport() {
  const level = usePlaybound((s) => s.level);
  const viewMode = usePlaybound((s) => s.viewMode);
  const select = usePlaybound((s) => s.select);
  const replacingLayout = usePlaybound((s) => s.proposals.some((p) => p.replaceAll));
  const previewBounds = usePlaybound((s) => {
    const proposed = s.proposals.find((p) => (p.replaceAll || p.bounds) && p.bounds);
    return proposed?.bounds && proposed.bounds > s.level.bounds ? proposed.bounds : s.level.bounds;
  });
  // While a layout read from an image is pending, show its floor image (the old level is faded).
  const previewGround = usePlaybound((s) => s.proposals.find((p) => p.replaceAll && p.ground?.imageUrl)?.ground);
  const showHeatmap = useUiPrefs((s) => s.showHeatmap);
  const prove = level.prove;
  const blueprint = isGreybox(level);
  const mapScale = previewBounds / 20;
  const shadowExtent = Math.max(35, previewBounds + 5);
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
        camera={{ position: ORBIT_POS, fov: 45, near: 0.1, far: Math.max(250, 140 * mapScale) }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={[bg]} />
        <fog
          attach="fog"
          args={[
            bg,
            (blueprint ? 70 : 55) * mapScale,
            (blueprint ? 140 : 120) * mapScale,
          ]}
        />
        <ambientLight intensity={blueprint ? 0.45 : 0.35} />
        <directionalLight
          castShadow
          position={[22 * mapScale, 40 * mapScale, 14 * mapScale]}
          intensity={blueprint ? 1.1 : 1.35}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={90 * mapScale}
          shadow-camera-left={-shadowExtent}
          shadow-camera-right={shadowExtent}
          shadow-camera-top={shadowExtent}
          shadow-camera-bottom={-shadowExtent}
        />
        <ViewPicker />
        <Suspense fallback={null}>
          {!blueprint && (
            <SceneBoundary label="sky">
              <Environment files={SKY_HDR} environmentIntensity={0.55} />
            </SceneBoundary>
          )}
          <Ground bounds={previewBounds} blueprint={blueprint} />
          <GroundImage ground={previewGround ?? level.ground} bounds={previewBounds} dim={blueprint} />
          {viewMode === "orbit" && <Heatmap />}
          {level.volumes.map((v) => (
            <VolumeMesh key={v.id} volume={v} faded={replacingLayout} />
          ))}
          <ProposalGhosts />
          {viewMode === "orbit" && <ProvePath prove={level.prove} />}
          {viewMode === "orbit" && <BotReplay />}
        </Suspense>

        {viewMode === "orbit" ? <OrbitRig bounds={previewBounds} /> : <FpsController level={level} />}
        {viewMode === "fps" && <StealthProbe level={level} />}
      </Canvas>

      <ProveResultCard />
      {viewMode === "fps" && <StealthHud />}
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

      {(level.ground?.credit || /cambridge|openstreetmap|\bosm\b/i.test(level.name)) && (
        <p className="map-credit">{level.ground?.credit ?? "© OpenStreetMap contributors"}</p>
      )}

      {viewMode === "fps" && (
        <div className="viewport-hint">Click to lock pointer · WASD move · Esc unlock</div>
      )}
    </main>
  );
}
