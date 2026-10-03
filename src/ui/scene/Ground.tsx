import { Grid } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { Level } from "../../core/types";

/** Procedural cobble/dirt albedo (no extra asset files). */
function makeGroundTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#7a7164";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 2 + Math.random() * 6;
    const shade = 90 + Math.floor(Math.random() * 50);
    ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 18})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(60,55,48,0.35)";
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y + (Math.random() * 4 - 2));
    ctx.lineTo(size, y + (Math.random() * 4 - 2));
    ctx.stroke();
  }
  for (let x = 0; x < size; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x + (Math.random() * 4 - 2), 0);
    ctx.lineTo(x + (Math.random() * 4 - 2), size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Textured floor + subtle 1 m / 5 m grid + low town-wall ring. */
export function Ground({ bounds }: { bounds: Level["bounds"] }) {
  const size = bounds * 2;
  const wallH = 1.2;
  const wallT = 0.4;
  const half = bounds;
  const map = useMemo(() => makeGroundTexture(), []);
  map.repeat.set(size / 4, size / 4);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={map} roughness={0.92} metalness={0} color="#c4b8a4" />
      </mesh>

      <Grid
        position={[0, 0.015, 0]}
        args={[size, size]}
        cellSize={1}
        cellThickness={0.45}
        cellColor="#00000055"
        sectionSize={5}
        sectionThickness={0.9}
        sectionColor="#00000088"
        fadeDistance={70}
        fadeStrength={0.85}
        infiniteGrid={false}
      />

      <mesh position={[0, wallH / 2, -half + wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[size, wallH, wallT]} />
        <meshStandardMaterial color="#5c5348" roughness={0.9} />
      </mesh>
      <mesh position={[0, wallH / 2, half - wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[size, wallH, wallT]} />
        <meshStandardMaterial color="#5c5348" roughness={0.9} />
      </mesh>
      <mesh position={[-half + wallT / 2, wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallT, wallH, size]} />
        <meshStandardMaterial color="#5c5348" roughness={0.9} />
      </mesh>
      <mesh position={[half - wallT / 2, wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallT, wallH, size]} />
        <meshStandardMaterial color="#5c5348" roughness={0.9} />
      </mesh>
    </group>
  );
}
