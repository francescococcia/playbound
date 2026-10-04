// Layout shell. Zones are owned by Cursor (src/ui/*). Keep this file thin.
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isPlayLink } from "./core/share";
import { CoDesignerPanel } from "./ui/panels/CoDesignerPanel";
import { LevelPanel } from "./ui/panels/LevelPanel";
import { Stepper } from "./ui/panels/Stepper";
import { PlayMode } from "./ui/play/PlayMode";
import { Viewport } from "./ui/scene/Viewport";
import { useUiPrefs } from "./ui/uiPrefs";

export default function App() {
  const panelOpen = useUiPrefs((s) => s.panelOpen);
  const setPanelOpen = useUiPrefs((s) => s.setPanelOpen);
  const togglePanel = useUiPrefs((s) => s.togglePanel);
  const coDesignerOpen = useUiPrefs((s) => s.coDesignerOpen);
  const toast = useUiPrefs((s) => s.toast);
  const setToast = useUiPrefs((s) => s.setToast);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setToastVisible(false);
      return;
    }
    const duration = toast.tone === "error" ? 8000 : 4000;
    setToastVisible(true);
    const exit = window.setTimeout(() => setToastVisible(false), duration - 180);
    const dismiss = window.setTimeout(() => setToast(null), duration);
    return () => {
      window.clearTimeout(exit);
      window.clearTimeout(dismiss);
    };
  }, [toast, setToast]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 961px)");
    const onChange = () => {
      if (mq.matches) setPanelOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setPanelOpen]);

  if (isPlayLink()) {
    return <PlayMode />;
  }

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
        <div
          className={`app-toast app-toast--${toast.tone}${toastVisible ? " app-toast--visible" : ""}`}
          role="status"
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
        >
          {toast.tone === "error" ? (
            <AlertTriangle size={16} strokeWidth={1.8} aria-hidden />
          ) : (
            <CheckCircle2 size={16} strokeWidth={1.8} aria-hidden />
          )}
          <span>{toast.message}</span>
          <button type="button" className="app-toast-close" onClick={() => setToast(null)} title="Dismiss notification">
            <X size={14} strokeWidth={1.8} aria-hidden />
            <span className="sr-only">Dismiss notification</span>
          </button>
        </div>
      )}
    </div>
  );
}
