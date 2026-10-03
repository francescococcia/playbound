// Layout shell. Zones are owned by Cursor (src/ui/*). Keep this file thin.
import { useEffect } from "react";
import { CoDesignerPanel } from "./ui/panels/CoDesignerPanel";
import { LevelPanel } from "./ui/panels/LevelPanel";
import { Stepper } from "./ui/panels/Stepper";
import { Viewport } from "./ui/scene/Viewport";
import { useUiPrefs } from "./ui/uiPrefs";

export default function App() {
  const panelOpen = useUiPrefs((s) => s.panelOpen);
  const setPanelOpen = useUiPrefs((s) => s.setPanelOpen);
  const togglePanel = useUiPrefs((s) => s.togglePanel);
  const coDesignerOpen = useUiPrefs((s) => s.coDesignerOpen);
  const toast = useUiPrefs((s) => s.toast);
  const setToast = useUiPrefs((s) => s.setToast);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 961px)");
    const onChange = () => {
      if (mq.matches) setPanelOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setPanelOpen]);

  return (
    <div
      className={[
        "app-shell",
        panelOpen ? "app-shell--level-open" : "",
        coDesignerOpen ? "app-shell--co-open" : "app-shell--co-collapsed",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Stepper />

      <div className="app-body">
        <button
          type="button"
          className="mobile-level-toggle"
          onClick={togglePanel}
          aria-expanded={panelOpen}
        >
          {panelOpen ? "Close level" : "Level"}
        </button>

        <LevelPanel />
        <Viewport />
        <CoDesignerPanel />

        {panelOpen && (
          <button
            type="button"
            className="panel-backdrop"
            aria-label="Close level panel"
            onClick={() => setPanelOpen(false)}
          />
        )}
      </div>

      {toast && (
        <button type="button" className="app-toast" onClick={() => setToast(null)} title="Dismiss">
          {toast}
        </button>
      )}
    </div>
  );
}
