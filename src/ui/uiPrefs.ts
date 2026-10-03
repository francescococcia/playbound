import { create } from "zustand";

/** UI-only prefs (not part of the level contract). */
export const useUiPrefs = create<{
  showColliders: boolean;
  setShowColliders: (v: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  togglePanel: () => void;
}>((set) => ({
  showColliders: false,
  setShowColliders: (showColliders) => set({ showColliders }),
  panelOpen: false,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}));
