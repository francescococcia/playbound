// Hero preset: "Market Square". 40 m x 40 m walled square (the bounds are the town wall).
// Layout (top view, north = -Z at the top):
//
//   clock tower        hay bales
//        fish stall     barrels
//              (well = objective)
//   [ tavern ]  corridor  [ guildhall ]   <- choke between z = 4..12
//              (south gate = spawn)
//
// FAIL variant: the market cart (the only cover) is parked in the far NW corner,
//   so the last stretch from the corridor to the well is open ground -> NO_COVER.
// PASS variant: the same cart dragged next to the route -> enough cover -> pass.
import type { Level, Volume } from "../core/types";

const base: Volume[] = [
  { id: "spawn", label: "south gate", role: "spawn", position: [0, 0, 17], rotationY: 0, size: [2, 0.1, 2] },
  { id: "well", label: "stone well", role: "objective", position: [0, 0, -6], rotationY: 0, size: [2, 1.1, 2] },
  { id: "tavern", label: "timber-framed tavern", role: "block", position: [-11, 0, 8], rotationY: 0, size: [18, 7, 8] },
  { id: "guildhall", label: "stone guildhall", role: "block", position: [11, 0, 8], rotationY: 0, size: [18, 8, 8] },
  { id: "tower", label: "clock tower", role: "landmark", position: [-12, 0, -13], rotationY: 0, size: [4, 14, 4] },
  { id: "fish-stall", label: "fish market stall with canvas awning", role: "prop", position: [11, 0, -5], rotationY: -0.3, size: [3, 2.6, 2] },
  { id: "barrels", label: "stack of wooden barrels", role: "prop", position: [-13, 0, -2], rotationY: 0, size: [1.6, 1.3, 1.6] },
  { id: "hay", label: "hay bales", role: "prop", position: [13, 0, -15], rotationY: 0.4, size: [2.2, 1, 1.2] },
  { id: "notice-board", label: "wooden notice board", role: "prop", position: [7, 0, 1], rotationY: 0.2, size: [1.6, 2.2, 0.3] },
];

const cartFar: Volume = {
  id: "cart",
  label: "low open wooden market cart, no canopy",
  role: "cover",
  position: [-16, 0, -17],
  rotationY: 0,
  size: [1.2, 1.2, 2.5],
};

const cartNear: Volume = { ...cartFar, position: [1.6, 0, -2] };

export const marketSquareFail: Level = {
  id: "market-square-fail",
  name: "Market Square (fail)",
  bounds: 20,
  locked: false,
  prove: { status: "idle" },
  volumes: [...base, cartFar],
};

export const marketSquarePass: Level = {
  id: "market-square-pass",
  name: "Market Square (pass)",
  bounds: 20,
  locked: false,
  prove: { status: "idle" },
  volumes: [...base, cartNear],
};

export const PRESETS: Level[] = [marketSquareFail, marketSquarePass];
