import { create } from "zustand";

/** UI-only prefs (not part of the level contract). */
export const useUiPrefs = create<{
  showColliders: boolean;
  setShowColliders: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  togglePanel: () => void;
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
  toast: null,
  setToast: (toast) => set({ toast }),
}));
