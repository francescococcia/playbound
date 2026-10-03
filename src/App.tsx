// Layout shell. Zones are owned by Cursor (src/ui/*). Keep this file thin.
import { TopBar } from "./ui/panels/TopBar";
import { SidePanel } from "./ui/panels/SidePanel";
import { Viewport } from "./ui/scene/Viewport";

export default function App() {
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%" }}>
      <TopBar />
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 0 }}>
        <SidePanel />
        <Viewport />
      </div>
    </div>
  );
}
