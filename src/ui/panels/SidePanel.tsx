// PLACEHOLDER — Cursor owns this. Replace freely.
import { usePlaybound } from "../../core/store";
import { PRESETS } from "../../presets/marketSquare";

export function SidePanel() {
  const { level, loadPreset } = usePlaybound();
  return (
    <aside style={{ padding: 8, borderRight: "1px solid #30363d", overflow: "auto" }}>
      <select value={level.id} onChange={(e) => loadPreset(e.target.value)}>
        {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <ul>{level.volumes.map((v) => <li key={v.id}>{v.label} — {v.role}</li>)}</ul>
    </aside>
  );
}
