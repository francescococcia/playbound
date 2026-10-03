import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import { usePlaybound } from "../../core/store";
import { FpsController } from "./FpsController";
import { Ground } from "./Ground";
import { ProveBanner } from "./ProveBanner";
import { ProvePath } from "./ProvePath";
import { VolumeMesh } from "./VolumeMesh";

/** High 3/4 overview: whole square, gate → corridor → well. */
const ORBIT_POS: [number, number, number] = [8, 48, 36];
const ORBIT_TARGET: [number, number, number] = [0, 0, 0];

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

  return (
    <main className="viewport">
      <Canvas
        shadows
        camera={{ position: ORBIT_POS, fov: 45, near: 0.1, far: 250 }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={["#87a0b8"]} />
        <fog attach="fog" args={["#87a0b8", 55, 120]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          castShadow
          position={[22, 40, 14]}
          intensity={1.35}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={90}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
        />
        <Suspense fallback={null}>
          <Environment preset="city" environmentIntensity={0.55} />
          <Ground bounds={level.bounds} />
          {level.volumes.map((v) => (
            <VolumeMesh key={v.id} volume={v} />
          ))}
          <ProvePath prove={level.prove} />
        </Suspense>

        {viewMode === "orbit" ? <OrbitRig /> : <FpsController level={level} />}
      </Canvas>

      <ProveBanner />

      {viewMode === "fps" && (
        <div className="viewport-hint">Click to lock pointer · WASD move · Esc unlock</div>
      )}
    </main>
  );
}
