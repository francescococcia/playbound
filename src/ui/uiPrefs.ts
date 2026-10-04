import { create } from "zustand";
import type { Step } from "../core/store";

export interface ToastNotice {
  id: number;
  message: string;
  tone: "info" | "error";
}

let toastId = 0;

/** UI-only prefs (not part of the level contract). */
export const useUiPrefs = create<{
  showColliders: boolean;
  setShowColliders: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  /** Mobile: left Level panel drawer. */
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  togglePanel: () => void;
  /** Desktop: left Level panel can be collapsed to a rail. */
  levelOpen: boolean;
  toggleLevel: () => void;
  /** Mobile / desktop: Co-designer collapse. */
  coDesignerOpen: boolean;
  setCoDesignerOpen: (v: boolean) => void;
  toggleCoDesigner: () => void;
  /** Manual stepper pick; null follows `currentStep(level)`. */
  stepOverride: Step | null;
  setStepOverride: (s: Step | null) => void;
  toast: ToastNotice | null;
  setToast: (msg: string | null, tone?: ToastNotice["tone"]) => void;
  /** What the designer did with each AI proposal (for "Accepted ✓" / "Dismissed" rows). */
  proposalOutcome: Record<string, "accepted" | "dismissed">;
  setProposalOutcome: (id: string, o: "accepted" | "dismissed") => void;
}>((set) => ({
  showColliders: false,
  setShowColliders: (showColliders) => set({ showColliders }),
  showHeatmap: true,
  setShowHeatmap: (showHeatmap) => set({ showHeatmap }),
  panelOpen: false,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  levelOpen: true,
  toggleLevel: () => set((s) => ({ levelOpen: !s.levelOpen })),
  coDesignerOpen: true,
  setCoDesignerOpen: (coDesignerOpen) => set({ coDesignerOpen }),
  toggleCoDesigner: () => set((s) => ({ coDesignerOpen: !s.coDesignerOpen })),
  stepOverride: null,
  setStepOverride: (stepOverride) => set({ stepOverride }),
  toast: null,
  setToast: (message, tone = "info") =>
    set({ toast: message ? { id: ++toastId, message, tone } : null }),
  proposalOutcome: {},
  setProposalOutcome: (id, o) => set((s) => ({ proposalOutcome: { ...s.proposalOutcome, [id]: o } })),
}));

// When the level itself moves to another step (Prove passed, layout locked, dressed…),
// drop any manual step pick so the stepper and action bar follow the real next step.
import { currentStep, usePlaybound } from "../core/store";
usePlaybound.subscribe((s, prev) => {
  if (currentStep(s.level) !== currentStep(prev.level)) useUiPrefs.getState().setStepOverride(null);
});
