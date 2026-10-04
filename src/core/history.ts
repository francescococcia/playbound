// Undo / redo for the layout (Round 4 · D).
// It watches the level instead of wrapping every action, so ALL edit paths are covered
// (buttons, drag, inspector, accepted AI proposals). Only layout changes are recorded
// (ids, roles, labels, positions, sizes, rotations), never Dress progress or Prove results.
// A drag is one step: changes to the same box within COALESCE_MS are merged.
import { create } from "zustand";
import { usePlaybound } from "./store";
import type { Level } from "./types";

const LIMIT = 60;
const COALESCE_MS = 600;

interface HistoryState {
  past: Level[];
  future: Level[];
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

let applying = false; // true while undo/redo writes the level (don't record that)
let lastPush = { at: 0, key: "" };

export const useHistory = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  undo: () => {
    const { past, future } = get();
    const cur = usePlaybound.getState().level;
    if (!past.length || cur.locked) return;
    const prev = past[past.length - 1];
    restore(prev);
    set({ past: past.slice(0, -1), future: [cur, ...future].slice(0, LIMIT) });
  },
  redo: () => {
    const { past, future } = get();
    const cur = usePlaybound.getState().level;
    if (!future.length || cur.locked) return;
    const next = future[0];
    restore(next);
    set({ past: [...past, cur].slice(-LIMIT), future: future.slice(1) });
  },
  clear: () => set({ past: [], future: [] }),
}));

function restore(level: Level) {
  applying = true;
  // Prove results describe the old layout: reset them; the user re-runs Prove.
  usePlaybound.setState({ level: { ...level, prove: { status: "idle" } } });
  applying = false;
  lastPush = { at: 0, key: "" };
}

/** The part of a level that undo cares about. */
export function layoutSignature(level: Level): string {
  return JSON.stringify(level.volumes.map((v) => [v.id, v.role, v.label, v.position, v.size, v.rotationY]));
}

/** Which single box changed (for coalescing drags), or "" if several / added / removed. */
function changedBoxKey(a: Level, b: Level): string {
  if (a.volumes.length !== b.volumes.length) return "";
  const diff = b.volumes.filter((v, i) => JSON.stringify(v) !== JSON.stringify(a.volumes[i]));
  return diff.length === 1 ? diff[0].id : "";
}

usePlaybound.subscribe((s, prev) => {
  if (applying || s.level === prev.level) return;
  // A different level (preset, new, share link, save): start a fresh history.
  if (s.level.id !== prev.level.id) {
    useHistory.getState().clear();
    return;
  }
  if (layoutSignature(s.level) === layoutSignature(prev.level)) return;
  const key = changedBoxKey(prev.level, s.level);
  const now = Date.now();
  const merge = key !== "" && key === lastPush.key && now - lastPush.at < COALESCE_MS;
  lastPush = { at: now, key };
  if (merge) return; // still the same drag: keep the snapshot from its start
  useHistory.setState((h) => ({ past: [...h.past, prev.level].slice(-LIMIT), future: [] }));
});

/** Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redo (not while typing). */
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      useHistory.getState().undo();
    } else if (k === "y" || (k === "z" && e.shiftKey)) {
      e.preventDefault();
      useHistory.getState().redo();
    }
  });
}
