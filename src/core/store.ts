// App state. Owned by Claude Code. UI (Cursor) reads state and calls actions; it never
// mutates `level` directly. Rule enforced here: once locked, the layout cannot change.
import { create } from "zustand";
import { PRESETS } from "../presets/marketSquare";
import { prove } from "./prove/prove";
import type { Level, Volume } from "./types";

export type ViewMode = "orbit" | "fps";

interface PlayboundState {
  level: Level;
  selectedId: string | null;
  viewMode: ViewMode;

  loadPreset: (id: string) => void;
  select: (id: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  /** Move/resize/relabel a volume. Ignored when the level is locked. Resets Prove to idle. */
  updateVolume: (id: string, patch: Partial<Pick<Volume, "position" | "rotationY" | "size" | "label" | "role">>) => void;
  runProve: () => void;
  /** Only allowed after a passing Prove. */
  lock: () => void;
  unlock: () => void;
  setStyleRef: (url: string | undefined, notes?: string) => void;
  /** Dress-side updates (asset url, prompt, status). Allowed while locked: visuals only. */
  setVolumeAsset: (
    id: string,
    patch: Partial<Pick<Volume, "assetUrl" | "prompt" | "status" | "error" | "stage" | "variant">>,
  ) => void;
}

const clone = (l: Level): Level => structuredClone(l);

export const usePlaybound = create<PlayboundState>((set, get) => ({
  level: clone(PRESETS[0]),
  selectedId: null,
  viewMode: "orbit",

  loadPreset: (id) => {
    const p = PRESETS.find((l) => l.id === id);
    if (p) set({ level: clone(p), selectedId: null });
  },
  select: (id) => set({ selectedId: id }),
  setViewMode: (viewMode) => set({ viewMode }),

  updateVolume: (id, patch) => {
    const { level } = get();
    if (level.locked) return;
    set({
      level: {
        ...level,
        prove: { status: "idle" },
        volumes: level.volumes.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      },
    });
  },

  runProve: () => {
    const { level } = get();
    set({ level: { ...level, prove: prove(level) } });
  },

  lock: () => {
    const { level } = get();
    if (level.prove?.status !== "pass") return;
    set({ level: { ...level, locked: true, volumes: level.volumes.map((v) => ({ ...v, locked: true })) } });
  },
  unlock: () => {
    const { level } = get();
    set({ level: { ...level, locked: false, volumes: level.volumes.map((v) => ({ ...v, locked: false })) } });
  },

  setStyleRef: (styleRefUrl, styleNotes) => {
    const { level } = get();
    set({ level: { ...level, styleRefUrl, styleNotes: styleNotes ?? level.styleNotes } });
  },

  setVolumeAsset: (id, patch) => {
    const { level } = get();
    set({ level: { ...level, volumes: level.volumes.map((v) => (v.id === id ? { ...v, ...patch } : v)) } });
  },
}));

/** Dress is allowed only when Prove passed AND the layout is locked AND a style ref exists. */
export function canDress(level: Level): { ok: boolean; why?: string } {
  if (level.prove?.status !== "pass") return { ok: false, why: "Prove must pass first." };
  if (!level.locked) return { ok: false, why: "Lock the layout first." };
  if (!level.styleRefUrl) return { ok: false, why: "Add a style reference image." };
  return { ok: true };
}
