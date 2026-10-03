import { usePlaybound } from "../../core/store";
import { PRESETS } from "../../presets/marketSquare";
import { ROLE_COLORS } from "../../core/types";

export function SidePanel() {
  const level = usePlaybound((s) => s.level);
  const selectedId = usePlaybound((s) => s.selectedId);
  const loadPreset = usePlaybound((s) => s.loadPreset);
  const select = usePlaybound((s) => s.select);
  const selected = level.volumes.find((v) => v.id === selectedId) ?? null;

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
                <span className="vol-row-label">{v.label}</span>
                <span className="vol-row-role">{v.role}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

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
          </div>
        ) : (
          <p className="muted">Click a box in the viewport or pick one from the list.</p>
        )}
      </div>
    </aside>
  );
}
