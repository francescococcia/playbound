import { usePlaybound } from "../../core/store";

export function TopBar() {
  const level = usePlaybound((s) => s.level);
  const viewMode = usePlaybound((s) => s.viewMode);
  const setViewMode = usePlaybound((s) => s.setViewMode);
  const runProve = usePlaybound((s) => s.runProve);
  const lock = usePlaybound((s) => s.lock);
  const unlock = usePlaybound((s) => s.unlock);

  return (
    <header className="top-bar">
      <strong className="brand">PLAYBOUND</strong>
      <span className="tagline">Prove the greybox. Then dress it.</span>

      <div className="view-toggle" role="group" aria-label="Camera mode">
        <button
          type="button"
          className={viewMode === "orbit" ? "active" : undefined}
          onClick={() => setViewMode("orbit")}
        >
          Orbit
        </button>
        <button
          type="button"
          className={viewMode === "fps" ? "active" : undefined}
          onClick={() => setViewMode("fps")}
        >
          FPS
        </button>
      </div>

      <span className="spacer" />

      <button type="button" onClick={runProve}>
        Prove
      </button>
      {level.locked ? (
        <button type="button" onClick={unlock}>
          Unlock
        </button>
      ) : (
        <button type="button" onClick={lock} disabled={level.prove?.status !== "pass"}>
          Lock
        </button>
      )}
      <span className="prove-msg">{level.prove?.message ?? "not proven"}</span>
    </header>
  );
}
