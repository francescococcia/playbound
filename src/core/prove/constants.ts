// Prove heuristic constants. Exposed on purpose: the README and the UI cite these.
// Prove = "a path exists" + "enough of that path has cover nearby". Not a combat sim.

export const GRID_CELL_M = 0.5;
export const COVER_RADIUS_M = 2.5;
export const MIN_COVERED_PATH_FRACTION = 0.25;
export const AGENT_RADIUS_M = 0.4;
export const AGENT_HEIGHT_M = 1.8;
/** Spawn/objective markers inside a wall or box snap to the nearest walkable cell within this distance. */
export const SNAP_RADIUS_M = 2;
