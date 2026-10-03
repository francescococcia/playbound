// App state. Owned by Claude Code. UI (Cursor) reads state and calls actions; it never
// mutates `level` directly. Rule enforced here: once locked, the layout cannot change.
import { create } from "zustand";
import { PRESETS } from "../presets/marketSquare";
import { prove } from "./prove/prove";
import type { Level, Proposal, Role, Volume } from "./types";

export type ViewMode = "orbit" | "fps";

interface PlayboundState {
  level: Level;
  selectedId: string | null;
  viewMode: ViewMode;
  /** Pending AI suggestions (ghosts). Accept/Reject only; never auto-applied. */
  proposals: Proposal[];

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

  // ---- Round 2: editing (all ignored while locked; all reset Prove to idle) ----
  /** Add a box at the given ground position (defaults by role). Returns the new id ("" if locked). */
  addVolume: (role: Role, position?: [number, number, number], patch?: Partial<Volume>) => string;
  removeVolume: (id: string) => void;
  duplicateVolume: (id: string) => string;
  /** Start an empty level: just a spawn and an objective. */
  newLevel: (name?: string) => void;
  /** Replace the level (load a save, open a share link, import). */
  setLevel: (level: Level) => void;

  // ---- Round 2: AI proposals ----
  addProposal: (p: Proposal) => void;
  acceptProposal: (id: string) => void;
  rejectProposal: (id: string) => void;
  clearProposals: () => void;
}

/** Default box size per role (meters): sensible first guess the designer then edits. */
export const DEFAULT_SIZE: Record<Role, [number, number, number]> = {
  spawn: [2, 0.1, 2],
  objective: [2, 1.1, 2],
  cover: [1.2, 1.2, 2.5],
  block: [8, 6, 8],
  landmark: [4, 12, 4],
  prop: [1.5, 1.5, 1.5],
};

const DEFAULT_LABEL: Record<Role, string> = {
  spawn: "player start",
  objective: "objective",
  cover: "low wall",
  block: "building",
  landmark: "tower",
  prop: "crate",
};

function uniqueId(base: string, taken: Set<string>): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "box";
  if (!taken.has(slug)) return slug;
  let i = 2;
  while (taken.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

const idle = { status: "idle" as const };

const clone = (l: Level): Level => structuredClone(l);

export const usePlaybound = create<PlayboundState>((set, get) => ({
  level: clone(PRESETS[0]),
  selectedId: null,
  viewMode: "orbit",
  proposals: [],

  loadPreset: (id) => {
    const p = PRESETS.find((l) => l.id === id);
    if (p) set({ level: clone(p), selectedId: null, proposals: [] });
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

  addVolume: (role, position = [0, 0, 0], patch = {}) => {
    const { level } = get();
    if (level.locked) return "";
    const label = patch.label ?? DEFAULT_LABEL[role];
    const id = uniqueId(patch.id ?? label, new Set(level.volumes.map((v) => v.id)));
    const v: Volume = { rotationY: 0, size: [...DEFAULT_SIZE[role]], ...patch, id, label, role, position };
    // Only one spawn and one objective: adding a new one replaces the old.
    const keep = role === "spawn" || role === "objective" ? level.volumes.filter((x) => x.role !== role) : level.volumes;
    set({ level: { ...level, prove: idle, volumes: [...keep, v] }, selectedId: id });
    return id;
  },

  removeVolume: (id) => {
    const { level, selectedId } = get();
    if (level.locked) return;
    set({
      level: { ...level, prove: idle, volumes: level.volumes.filter((v) => v.id !== id) },
      selectedId: selectedId === id ? null : selectedId,
    });
  },

  duplicateVolume: (id) => {
    const { level } = get();
    const v = level.volumes.find((x) => x.id === id);
    if (!v || level.locked || v.role === "spawn" || v.role === "objective") return "";
    const { assetUrl: _a, status: _s, prompt: _p, variant: _v, stage: _st, error: _e, ...rest } = v;
    return get().addVolume(v.role, [v.position[0] + 1.5, 0, v.position[2] + 1.5], { ...rest, id: v.id });
  },

  newLevel: (name = "Untitled level") => {
    set({
      level: {
        id: `level-${Date.now().toString(36)}`,
        name,
        bounds: 20,
        locked: false,
        prove: idle,
        volumes: [
          { id: "spawn", label: "player start", role: "spawn", position: [0, 0, 17], rotationY: 0, size: [...DEFAULT_SIZE.spawn] },
          { id: "objective", label: "objective", role: "objective", position: [0, 0, -12], rotationY: 0, size: [...DEFAULT_SIZE.objective] },
        ],
      },
      selectedId: null,
      proposals: [],
    });
  },

  setLevel: (level) => set({ level: clone(level), selectedId: null, proposals: [] }),

  addProposal: (p) => set({ proposals: [...get().proposals.filter((x) => x.id !== p.id), p] }),
  rejectProposal: (id) => set({ proposals: get().proposals.filter((p) => p.id !== id) }),
  clearProposals: () => set({ proposals: [] }),

  acceptProposal: (id) => {
    const { level, proposals } = get();
    const p = proposals.find((x) => x.id === id);
    if (!p) return;
    const rest = proposals.filter((x) => x.id !== id);
    const changesLayout = !!(p.add?.length || p.update?.length || p.remove?.length || p.replaceAll);
    if (changesLayout && level.locked) return; // contract is locked: only style proposals apply
    let volumes = p.replaceAll ? [] : level.volumes.filter((v) => !p.remove?.includes(v.id));
    volumes = volumes.map((v) => {
      const u = p.update?.find((x) => x.id === v.id);
      return u ? { ...v, ...(u.position && { position: u.position }), ...(u.rotationY !== undefined && { rotationY: u.rotationY }), ...(u.size && { size: u.size }) } : v;
    });
    const taken = new Set(volumes.map((v) => v.id));
    for (const a of p.add ?? []) {
      const nid = uniqueId(a.id, taken);
      taken.add(nid);
      if (a.role === "spawn" || a.role === "objective") volumes = volumes.filter((v) => v.role !== a.role);
      volumes.push({ ...a, id: nid });
    }
    set({
      level: {
        ...level,
        volumes,
        styleNotes: p.styleNotes ?? level.styleNotes,
        prove: changesLayout ? idle : level.prove,
      },
      proposals: rest,
    });
  },
}));

/** Dress is allowed only when Prove passed AND the layout is locked AND a style ref exists. */
export function canDress(level: Level): { ok: boolean; why?: string } {
  if (level.prove?.status !== "pass") return { ok: false, why: "Prove must pass first." };
  if (!level.locked) return { ok: false, why: "Lock the layout first." };
  if (!level.styleRefUrl) return { ok: false, why: "Add a style reference image." };
  return { ok: true };
}
