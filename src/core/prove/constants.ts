// Prove heuristic constants. Exposed on purpose: the README and the UI cite these.
// Prove = "a path exists" + "enough of that path is protected". A route point is protected
// when it is OUT OF SIGHT of the objective (line of sight) OR within reach of a cover box.
// Not a combat sim.

export const GRID_CELL_M = 0.5;
export const COVER_RADIUS_M = 2.5;
export const MIN_COVERED_PATH_FRACTION = 0.25;
export const AGENT_RADIUS_M = 0.4;
export const AGENT_HEIGHT_M = 1.8;
/** Spawn/objective markers inside a wall or box snap to the nearest walkable cell within this distance. */
export const SNAP_RADIUS_M = 2;
/** Line of sight: defender's eye at the objective, aiming at a crouching player's head. */
export const VIEWER_EYE_M = 1.7;
export const TARGET_HEIGHT_M = 1.0;
export const LOS_STEP_M = 0.25;
