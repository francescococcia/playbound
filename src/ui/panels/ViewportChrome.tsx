import { Box, Eye, Map } from "lucide-react";
import { usePlaybound } from "../../core/store";
import { useUiPrefs } from "../uiPrefs";

/** Floating viewport controls (bottom-left): view mode, heatmap, colliders. */
export function ViewportChrome() {
  const viewMode = usePlaybound((s) => s.viewMode);
  const setViewMode = usePlaybound((s) => s.setViewMode);
  const prove = usePlaybound((s) => s.level.prove);
  const showColliders = useUiPrefs((s) => s.showColliders);
  const setShowColliders = useUiPrefs((s) => s.setShowColliders);
  const showHeatmap = useUiPrefs((s) => s.showHeatmap);
  const setShowHeatmap = useUiPrefs((s) => s.setShowHeatmap);

  const heatmapAvailable =
    !!prove && prove.status !== "idle" && !!prove.exposure?.length;

  return (
    <div className="viewport-chrome" role="toolbar" aria-label="Viewport controls">
      <div className="chrome-group" role="group" aria-label="Camera">
        <button
          type="button"
          className={viewMode === "orbit" ? "active" : undefined}
          onClick={() => setViewMode("orbit")}
          title="Orbit camera"
        >
          <Map size={16} strokeWidth={1.75} />
          Orbit
        </button>
        <button
          type="button"
          className={viewMode === "fps" ? "active" : undefined}
          onClick={() => setViewMode("fps")}
          title="First-person walk"
        >
          <Eye size={16} strokeWidth={1.75} />
          Walk
        </button>
      </div>

      <div className="chrome-group" role="group" aria-label="Overlays">
        <button
          type="button"
          className={showHeatmap && heatmapAvailable ? "active" : undefined}
          disabled={!heatmapAvailable}
          title={heatmapAvailable ? "Toggle exposure heatmap" : "Run Prove to see the heatmap"}
          onClick={() => setShowHeatmap(!showHeatmap)}
        >
          Heatmap
        </button>
        <button
          type="button"
          className={showColliders ? "active" : undefined}
          title="Show collision boxes"
          onClick={() => setShowColliders(!showColliders)}
        >
          <Box size={16} strokeWidth={1.75} />
          Colliders
        </button>
      </div>
    </div>
  );
}
