import { useEffect, useState } from "react";
import { usePlaybound } from "../../core/store";

/** Overlay banner for Prove result. Hidden in FPS (fades out after a short beat if just switched). */
export function ProveBanner() {
  const prove = usePlaybound((s) => s.level.prove);
  const viewMode = usePlaybound((s) => s.viewMode);
  const [fpsHidden, setFpsHidden] = useState(false);

  useEffect(() => {
    if (viewMode !== "fps") {
      setFpsHidden(false);
      return;
    }
    // Clear HUD quickly for the video shot.
    const t = window.setTimeout(() => setFpsHidden(true), 3000);
    return () => window.clearTimeout(t);
  }, [viewMode, prove?.checkedAt, prove?.status]);

  if (!prove || prove.status === "idle") return null;
  if (viewMode === "fps" && fpsHidden) return null;

  const tone = prove.status === "pass" ? "pass" : "fail";
  const fading = viewMode === "fps";

  return (
    <div
      className={`prove-banner prove-banner--${tone}${fading ? " prove-banner--fps-fade" : ""}`}
      role="status"
    >
      <div className="prove-banner-msg">{prove.message ?? (prove.status === "pass" ? "Pass" : "Fail")}</div>
      <div className="prove-banner-note">Prove = path + cover heuristic, not a combat sim.</div>
    </div>
  );
}
