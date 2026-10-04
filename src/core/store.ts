// App state. Owned by Claude Code. UI (Cursor) reads state and calls actions; it never
// mutates `level` directly. Rule enforced here: once locked, the layout cannot change.
import { create } from "zustand";
import { PRESETS } from "../presets/marketSquare";
import { prove } from "./prove/prove";
import { keepInside } from "./layout";
import { DRESS_ROLES, type Level, type Proposal, type Role, type Volume } from "./types";

export type ViewMode = "orbit" | "fps";

/** One bubble in the Co-designer panel. */
export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  /** User attached an image (shown as a thumbnail; the data stays out of the thread). */
  imageThumb?: string;
  /** Proposals this answer created (look them up in `proposals`; gone once accepted/dismissed). */
  proposalIds?: string[];
  chips?: string[];
  intent?: string;
  model?: string;
  pending?: boolean;
  error?: string;
}

interface PlayboundState {
  level: Level;
  selectedId: string | null;
  viewMode: ViewMode;
  /** Pending AI suggestions (ghosts). Accept/Reject only; never auto-applied. */
  proposals: Proposal[];
  /** Proposal the user is previewing (hover/"Preview"): UI highlights its ghosts. */
  highlightedProposalId: string | null;
  /** Co-designer conversation, oldest first. */
  agentThread: AgentMessage[];
  /** Id of the last message before the layout was replaced: older turns are about another level, so they aren't sent as context. */
  agentContextAfter: string | null;

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
    patch: Partial<Pick<Volume, "assetUrl" | "prompt" | "status" | "error" | "stage" | "variant" | "standIn">>,
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
  /** Accept several proposals in order (skips ones that no longer apply). */
  acceptAll: (ids: string[]) => void;
  setHighlightedProposal: (id: string | null) => void;
  /** Change the map size (half-extent 20 / 30 / 40). Not while locked; boxes are kept inside. */
  setMapBounds: (bounds: number) => { ok: boolean; why?: string };
  pushAgentMessage: (m: AgentMessage) => void;
  updateAgentMessage: (id: string, patch: Partial<AgentMessage>) => void;
  clearAgentThread: () => void;
}

// ---- Round 3: the guided flow ----

export type Step = "blockout" | "prove" | "lock" | "dress" | "play";
export const STEPS: { id: Step; label: string }[] = [
  { id: "blockout", label: "Block out" },
  { id: "prove", label: "Prove" },
  { id: "lock", label: "Lock" },
  { id: "dress", label: "Dress" },
  { id: "play", label: "Play & share" },
];

/**
 * Where the user is in the pipeline, derived from the level (no extra state to get out of sync):
 * - blockout: no spawn/objective yet, or fewer than 3 boxes
 * - prove:    layout exists but Prove is idle or failing
 * - lock:     Prove passed, not locked
 * - dress:    locked, not every dressable box is ready
 * - play:     locked and fully dressed
 */
export function currentStep(level: Level): Step {
  const hasMarkers = level.volumes.some((v) => v.role === "spawn") && level.volumes.some((v) => v.role === "objective");
  if (!hasMarkers || level.volumes.length < 3) return "blockout";
  if (level.prove?.status !== "pass") return "prove";
  if (!level.locked) return "lock";
  const dressable = level.volumes.filter((v) => DRESS_ROLES.includes(v.role));
  if (dressable.some((v) => v.status !== "ready")) return "dress";
  return "play";
}

/** Can the user open this step now? (Earlier steps are always reachable; later ones need their gate.) */
export function canEnterStep(level: Level, step: Step): { ok: boolean; why?: string } {
  const order = STEPS.map((s) => s.id);
  const target = order.indexOf(step);
  if (target <= order.indexOf(currentStep(level))) return { ok: true };
  if (step === "prove") return { ok: false, why: "Add a spawn, an objective and some boxes first." };
  if (step === "lock") return { ok: false, why: "Prove must pass first." };
  if (step === "dress") return { ok: false, why: "Lock the layout first." };
  return { ok: false, why: "Dress the level first." };
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
  highlightedProposalId: null,
  agentThread: [],
  agentContextAfter: null,

  loadPreset: (id) => {
    const p = PRESETS.find((l) => l.id === id);
    if (p) set({ level: clone(p), selectedId: null, proposals: [], agentContextAfter: get().agentThread.at(-1)?.id ?? null });
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
        volumes: level.volumes.map((v) => (v.id === id ? { ...v, ...patch, ...(patch.size && needsRedress(v)) } : v)),
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
      agentContextAfter: get().agentThread.at(-1)?.id ?? null,
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

  setLevel: (level) => set({ level: clone(level), selectedId: null, proposals: [], agentContextAfter: get().agentThread.at(-1)?.id ?? null }),

  addProposal: (p) => set({ proposals: [...get().proposals.filter((x) => x.id !== p.id), p] }),
  rejectProposal: (id) =>
    set({
      proposals: get().proposals.filter((p) => p.id !== id),
      highlightedProposalId: get().highlightedProposalId === id ? null : get().highlightedProposalId,
    }),
  clearProposals: () => set({ proposals: [], highlightedProposalId: null }),
  acceptAll: (ids) => {
    for (const id of ids) get().acceptProposal(id);
  },
  setHighlightedProposal: (id) => set({ highlightedProposalId: id }),
  pushAgentMessage: (m) => set({ agentThread: [...get().agentThread, m].slice(-40) }),
  updateAgentMessage: (id, patch) => set({ agentThread: get().agentThread.map((m) => (m.id === id ? { ...m, ...patch } : m)) }),
  clearAgentThread: () => set({ agentThread: [], agentContextAfter: null }),

  acceptProposal: (id) => {
    const { level, proposals } = get();
    const p = proposals.find((x) => x.id === id);
    if (!p) return;
    const rest = proposals.filter((x) => x.id !== id);
    if (p.unlock) {
      set({ level: { ...level, locked: false, volumes: level.volumes.map((v) => ({ ...v, locked: false })) }, proposals: rest });
      return;
    }
    const changesLayout = !!(p.add?.length || p.update?.length || p.remove?.length || p.replaceAll);
    if (changesLayout && level.locked) return; // contract is locked: only style proposals apply
    let volumes = p.replaceAll ? [] : level.volumes.filter((v) => !p.remove?.includes(v.id));
    volumes = volumes.map((v) => {
      const u = p.update?.find((x) => x.id === v.id);
      return u ? { ...v, ...(u.position && { position: u.position }), ...(u.rotationY !== undefined && { rotationY: u.rotationY }), ...(u.size && { size: u.size, ...needsRedress(v) }) } : v;
    });
    // Look change: the listed boxes get a new variant at the next Dress (current model stays until then).
    if (p.redress) {
      volumes = volumes.map((v) =>
        p.redress!.ids.includes(v.id) ? { ...v, lookNote: p.redress!.note ?? v.lookNote, variant: (v.variant ?? 0) + 1, ...needsRedress(v) } : v,
      );
    }
    const taken = new Set(volumes.map((v) => v.id));
    for (const a of p.add ?? []) {
      const nid = uniqueId(a.id, taken);
      taken.add(nid);
      if (a.role === "spawn" || a.role === "objective") volumes = volumes.filter((v) => v.role !== a.role);
      volumes.push({ ...a, id: nid });
    }
    const bounds = p.bounds ?? level.bounds;
    if (p.bounds) volumes = volumes.map((v) => keepInside(v, bounds));
    const thread = get().agentThread;
    set({
      level: {
        ...level,
        // A replaced layout is a new level: it must not keep a preset's id (preset menu, saves).
        id: p.replaceAll ? `level-${Date.now().toString(36)}` : level.id,
        volumes,
        bounds,
        name: p.replaceAll && p.levelName ? p.levelName : level.name,
        ground: p.replaceAll ? (p.ground?.imageUrl ? p.ground : undefined) : level.ground,
        styleNotes: p.styleNotes ?? level.styleNotes,
        prove: changesLayout || p.bounds ? idle : level.prove,
      },
      proposals: rest,
      ...(p.replaceAll && { agentContextAfter: thread[thread.length - 1]?.id ?? null }),
    });
  },
  setMapBounds: (bounds) => {
    const { level } = get();
    if (level.locked) return { ok: false, why: "Unlock the layout to change the map size." };
    if (bounds === level.bounds) return { ok: true };
    const volumes = level.volumes.map((v) => keepInside(v, bounds));
    set({ level: { ...level, bounds, volumes, prove: idle } });
    return { ok: true };
  },
}));

/** A dressed box whose size or look changed: Dress makes a new model (the old one shows until then). */
function needsRedress(v: Volume): Partial<Volume> {
  return v.status === "ready" ? { status: "empty" } : {};
}

/** Dress is allowed once gameplay is locked and there is a written or visual style direction. */
export function canDress(level: Level): { ok: boolean; why?: string } {
  if (level.prove?.status !== "pass") return { ok: false, why: "Prove must pass first." };
  if (!level.locked) return { ok: false, why: "Lock the layout first." };
  if (!level.styleNotes?.trim() && !level.styleRefUrl) {
    return { ok: false, why: "Describe a style or add a reference image." };
  }
  return { ok: true };
}
