// Layout shell. Zones are owned by Cursor (src/ui/*). Keep this file thin.
import { TopBar } from "./ui/panels/TopBar";
import { SidePanel } from "./ui/panels/SidePanel";
import { Viewport } from "./ui/scene/Viewport";
import { useUiPrefs } from "./ui/uiPrefs";

export default function App() {
  const panelOpen = useUiPrefs((s) => s.panelOpen);
  const setPanelOpen = useUiPrefs((s) => s.setPanelOpen);

  return (
    <div className="app-shell">
      <TopBar />
      <div className={`app-body${panelOpen ? " app-body--panel-open" : ""}`}>
        <SidePanel />
        <Viewport />
        {panelOpen && (
          <button
            type="button"
            className="panel-backdrop"
            aria-label="Close panel"
            onClick={() => setPanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
