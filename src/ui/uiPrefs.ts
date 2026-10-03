import { create } from "zustand";

/** UI-only prefs (not part of the level contract). */
export const useUiPrefs = create<{
  showColliders: boolean;
  setShowColliders: (v: boolean) => void;
}>((set) => ({
  showColliders: false,
  setShowColliders: (showColliders) => set({ showColliders }),
}));
