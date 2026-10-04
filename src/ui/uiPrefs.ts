import { create } from "zustand";
import type { Step } from "../core/store";

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
  /** Mobile / desktop: Co-designer collapse. */
  coDesignerOpen: boolean;
  setCoDesignerOpen: (v: boolean) => void;
  toggleCoDesigner: () => void;
  /** Manual stepper pick; null follows `currentStep(level)`. */
  stepOverride: Step | null;
  setStepOverride: (s: Step | null) => void;
  toast: string | null;
  setToast: (msg: string | null) => void;
}>((set) => ({
  showColliders: false,
  setShowColliders: (showColliders) => set({ showColliders }),
  showHeatmap: true,
  setShowHeatmap: (showHeatmap) => set({ showHeatmap }),
  panelOpen: false,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  coDesignerOpen: true,
  setCoDesignerOpen: (coDesignerOpen) => set({ coDesignerOpen }),
  toggleCoDesigner: () => set((s) => ({ coDesignerOpen: !s.coDesignerOpen })),
  stepOverride: null,
  setStepOverride: (stepOverride) => set({ stepOverride }),
  toast: null,
  setToast: (toast) => set({ toast }),
}));
