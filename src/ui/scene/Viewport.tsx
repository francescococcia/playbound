import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import { usePlaybound } from "../../core/store";
import { FpsController } from "./FpsController";
import { Ground } from "./Ground";
import { VolumeMesh } from "./VolumeMesh";

const ORBIT_POS: [number, number, number] = [18, 22, 28];

function OrbitRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...ORBIT_POS);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return <OrbitControls makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.05} />;
}

export function Viewport() {
  const level = usePlaybound((s) => s.level);
  const viewMode = usePlaybound((s) => s.viewMode);
  const select = usePlaybound((s) => s.select);

  return (
    <main className="viewport">
      <Canvas
        shadows
        camera={{ position: ORBIT_POS, fov: 50, near: 0.1, far: 200 }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={["#0d1117"]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          castShadow
          position={[20, 30, 10]}
          intensity={1.1}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={80}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <Suspense fallback={null}>
          <Ground bounds={level.bounds} />
          {level.volumes.map((v) => (
            <VolumeMesh key={v.id} volume={v} />
          ))}
        </Suspense>

        {viewMode === "orbit" ? <OrbitRig /> : <FpsController level={level} />}
      </Canvas>

      {viewMode === "fps" && (
        <div className="viewport-hint">Click to lock pointer · WASD move · Esc unlock</div>
      )}
    </main>
  );
}
