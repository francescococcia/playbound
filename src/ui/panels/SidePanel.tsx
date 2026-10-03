import { useEffect, useState } from "react";
import { isLiveAvailable, regenerate } from "../../core/dress/dress";
import { usePlaybound } from "../../core/store";
import { DRESS_ROLES, ROLE_COLORS, type Role } from "../../core/types";
import { shortLabel } from "../label";
import { useUiPrefs } from "../uiPrefs";
import { PRESETS } from "../../presets/marketSquare";
import { EditTools } from "./EditTools";

const ROLES: Role[] = ["spawn", "objective", "cover", "block", "landmark", "prop"];

function statusTone(status: string | undefined) {
  if (status === "ready") return "ok";
  if (status === "error") return "err";
  if (status === "queued" || status === "generating") return "busy";
  return "";
}

function num(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function SidePanel() {
  const level = usePlaybound((s) => s.level);
  const selectedId = usePlaybound((s) => s.selectedId);
  const loadPreset = usePlaybound((s) => s.loadPreset);
  const select = usePlaybound((s) => s.select);
  const updateVolume = usePlaybound((s) => s.updateVolume);
  const showColliders = useUiPrefs((s) => s.showColliders);
  const setShowColliders = useUiPrefs((s) => s.setShowColliders);
  const selected = level.volumes.find((v) => v.id === selectedId) ?? null;
  const locked = level.locked;
  const dressables = level.volumes.filter((v) => DRESS_ROLES.includes(v.role));
  const anyDressing = dressables.some((v) => v.status && v.status !== "empty");

  const [liveOk, setLiveOk] = useState<boolean | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    isLiveAvailable().then((ok) => {
      if (!cancelled) setLiveOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canRegen =
    selected != null &&
    DRESS_ROLES.includes(selected.role) &&
    liveOk === true &&
    !regenBusy &&
    selected.status !== "queued" &&
    selected.status !== "generating";

  const regenTitle =
    liveOk === false
      ? "needs Hyper3D connection"
      : liveOk === null
        ? "Checking Hyper3D…"
        : !selected || !DRESS_ROLES.includes(selected.role)
          ? "Select a dressable volume"
          : regenBusy || selected.status === "queued" || selected.status === "generating"
            ? "Generating…"
            : "Regenerate this volume (uses credits)";

  const onRegenerate = async () => {
    if (!selected || !canRegen) return;
    setRegenBusy(true);
    setRegenError(null);
    try {
      await regenerate(selected.id);
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenBusy(false);
    }
  };

  return (
    <aside className="side-panel">
      <label className="field">
        <span className="field-label">Preset</span>
        <select value={level.id} onChange={(e) => loadPreset(e.target.value)} disabled={locked} title={locked ? "Unlock to switch preset" : undefined}>
          {!PRESETS.some((p) => p.id === level.id) && (
            <option value={level.id}>{level.name}</option>
          )}
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <EditTools />

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
            <label className="field">
              <span className="field-label">Label</span>
              <input
                type="text"
                value={selected.label}
                disabled={locked}
                onChange={(e) => updateVolume(selected.id, { label: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Role</span>
              <select
                value={selected.role}
                disabled={locked}
                onChange={(e) => updateVolume(selected.id, { role: e.target.value as Role })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="field-label">Size (W × H × D) m</span>
              <div className="size-row">
                {([0, 1, 2] as const).map((i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={selected.size[i]}
                    disabled={locked}
                    aria-label={["Width", "Height", "Depth"][i]}
                    onChange={(e) => {
                      const next: [number, number, number] = [...selected.size];
                      next[i] = Math.max(0.1, num(e.target.value, selected.size[i]));
                      updateVolume(selected.id, { size: next });
                    }}
                  />
                ))}
              </div>
            </div>
            <label className="field">
              <span className="field-label">Rotation (°)</span>
              <input
                type="number"
                step="1"
                value={Math.round((selected.rotationY * 180) / Math.PI)}
                disabled={locked}
                onChange={(e) =>
                  updateVolume(selected.id, {
                    rotationY: (num(e.target.value, 0) * Math.PI) / 180,
                  })
                }
              />
            </label>
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
            {(selected.prompt || DRESS_ROLES.includes(selected.role)) && (
              <div className="field">
                <span className="field-label">Prompt</span>
                <div className="field-value prompt-text">
                  {selected.prompt ?? "— (set after Dress / Regenerate)"}
                </div>
              </div>
            )}
            {DRESS_ROLES.includes(selected.role) && (
              <div className="field">
                <button
                  type="button"
                  className="regen-btn"
                  onClick={onRegenerate}
                  disabled={!canRegen}
                  title={regenTitle}
                >
                  {regenBusy || selected.status === "queued" || selected.status === "generating" ? (
                    <span className="regen-spin" aria-hidden />
                  ) : null}
                  {regenBusy || selected.status === "queued" || selected.status === "generating"
                    ? "Regenerating…"
                    : "Regenerate"}
                </button>
                {liveOk === false && (
                  <p className="muted" style={{ marginTop: "0.35rem" }}>
                    needs Hyper3D connection
                  </p>
                )}
                {regenError && <p className="dress-error">{regenError}</p>}
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
