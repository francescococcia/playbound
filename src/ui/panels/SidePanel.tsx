import { usePlaybound } from "../../core/store";
import { DRESS_ROLES, ROLE_COLORS } from "../../core/types";
import { shortLabel } from "../label";
import { useUiPrefs } from "../uiPrefs";
import { PRESETS } from "../../presets/marketSquare";

function statusTone(status: string | undefined) {
  if (status === "ready") return "ok";
  if (status === "error") return "err";
  if (status === "queued" || status === "generating") return "busy";
  return "";
}

export function SidePanel() {
  const level = usePlaybound((s) => s.level);
  const selectedId = usePlaybound((s) => s.selectedId);
  const loadPreset = usePlaybound((s) => s.loadPreset);
  const select = usePlaybound((s) => s.select);
  const showColliders = useUiPrefs((s) => s.showColliders);
  const setShowColliders = useUiPrefs((s) => s.setShowColliders);
  const selected = level.volumes.find((v) => v.id === selectedId) ?? null;
  const dressables = level.volumes.filter((v) => DRESS_ROLES.includes(v.role));
  const anyDressing = dressables.some((v) => v.status && v.status !== "empty");

  return (
    <aside className="side-panel">
      <label className="field">
        <span className="field-label">Preset</span>
        <select value={level.id} onChange={(e) => loadPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showColliders}
          onChange={(e) => setShowColliders(e.target.checked)}
        />
        <span>Show colliders</span>
      </label>

      <div className="side-section">
        <h2>Volumes</h2>
        <ul className="vol-list">
          {level.volumes.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                className={`vol-row${selectedId === v.id ? " vol-row--selected" : ""}`}
                onClick={() => select(v.id)}
              >
                <span className="vol-swatch" style={{ background: ROLE_COLORS[v.role] }} />
                <span className="vol-row-label" title={v.label}>
                  {shortLabel(v.label, 28)}
                </span>
                <span className="vol-row-role">{v.role}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {anyDressing && (
        <div className="side-section">
          <h2>Dress progress</h2>
          <ul className="dress-list">
            {dressables.map((v) => (
              <li key={v.id} className={`dress-row dress-row--${statusTone(v.status)}`}>
                <button type="button" className="dress-row-btn" onClick={() => select(v.id)}>
                  <span className="dress-name">{shortLabel(v.label, 20)}</span>
                  <span className="dress-status">
                    {v.status ?? "empty"}
                    {v.stage ? ` · ${v.stage}` : ""}
                  </span>
                  {v.error && <span className="dress-error">{v.error}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="side-section">
        <h2>Inspector</h2>
        {selected ? (
          <div className="inspector">
            <div className="field">
              <span className="field-label">Label</span>
              <div className="field-value">{selected.label}</div>
            </div>
            <div className="field">
              <span className="field-label">Role</span>
              <div className="field-value inspector-role">
                <span className="vol-swatch" style={{ background: ROLE_COLORS[selected.role] }} />
                {selected.role}
              </div>
            </div>
            <div className="field">
              <span className="field-label">Size (W × H × D)</span>
              <div className="field-value mono">
                {selected.size[0].toFixed(1)} × {selected.size[1].toFixed(1)} × {selected.size[2].toFixed(1)} m
              </div>
            </div>
            <div className="field">
              <span className="field-label">Position</span>
              <div className="field-value mono">
                ({selected.position[0].toFixed(1)}, {selected.position[1].toFixed(1)}, {selected.position[2].toFixed(1)})
              </div>
            </div>
            {selected.status && (
              <div className="field">
                <span className="field-label">Dress</span>
                <div className={`field-value dress-row--${statusTone(selected.status)}`}>
                  {selected.status}
                  {selected.stage ? ` · ${selected.stage}` : ""}
                  {selected.error ? ` — ${selected.error}` : ""}
                </div>
              </div>
            )}
            {selected.assetUrl && (
              <div className="field">
                <span className="field-label">Asset</span>
                <div className="field-value mono" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                  {selected.assetUrl}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="muted">Click a box in the viewport or pick one from the list.</p>
        )}
      </div>
    </aside>
  );
}
