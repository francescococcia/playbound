import * as THREE from "three";

/** Ground-plane pick under the view centre (registered by Viewport). */
type Picker = () => [number, number, number];

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const HIT = new THREE.Vector3();
const NDC = new THREE.Vector2(0, 0);
const RAY = new THREE.Raycaster();

let picker: Picker = () => [0, 0, 0];

export function setViewGroundPicker(fn: Picker) {
  picker = fn;
}

export function viewGroundCenter(): [number, number, number] {
  return picker();
}

/** Helper for Viewport: ray from camera through screen centre onto y = 0. */
export function groundUnderCamera(camera: THREE.Camera): [number, number, number] {
  RAY.setFromCamera(NDC, camera);
  if (!RAY.ray.intersectPlane(GROUND, HIT)) return [0, 0, 0];
  return [HIT.x, 0, HIT.z];
}
