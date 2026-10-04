// Motion helpers for the 3D scene (DOM motion uses `motion/react`).
// Every scene animation checks reducedMotion() and jumps to its end state if set.

export const reducedMotion = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** easeOutCubic, t in [0, 1]. */
export const easeOut = (t: number): number => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

/** DESIGN_BRIEF colours used in the scene. */
export const SCENE = {
  proof: "#3ddc97",
  danger: "#ff6b5a",
  ai: "#a78bfa",
  amber: "#f2c14e",
} as const;
