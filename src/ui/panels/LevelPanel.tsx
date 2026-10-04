import { Camera, PanelLeftClose, PanelLeftOpen, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isLiveAvailable, regenerate, regenerateFromImage } from "../../core/dress/dress";
import { toJpegDataUrl } from "../../core/image";
import { MAP_SIZES } from "../../core/layout";
import { usePlaybound } from "../../core/store";
import { DRESS_ROLES, ROLE_COLORS, type Role } from "../../core/types";
import { shortLabel } from "../label";
import { useUiPrefs } from "../uiPrefs";
import { EditTools } from "./EditTools";
import { PRESETS } from "../../presets/marketSquare";

const ICON = { size: 16, strokeWidth: 1.75 } as const;

const ROLE_ORDER: Role[] = ["spawn", "objective", "cover", "block", "landmark", "prop"];

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

/** Left "Level" panel: boxes by role, edit tools, inspector. */
export function LevelPanel() {
  const level = usePlaybound((s) => s.level);
  const selectedId = usePlaybound((s) => s.selectedId);
  const loadPreset = usePlaybound((s) => s.loadPreset);
  const select = usePlaybound((s) => s.select);
  const updateVolume = usePlaybound((s) => s.updateVolume);
  const setMapBounds = usePlaybound((s) => s.setMapBounds);
  const suggestedBounds = usePlaybound((s) => {
    const proposed = s.proposals.find((p) => (p.replaceAll || p.bounds) && p.bounds && p.bounds > s.level.bounds);
    return proposed?.bounds;
  });
  const setToast = useUiPrefs((s) => s.setToast);
  const levelOpen = useUiPrefs((s) => s.levelOpen);
  const toggleLevel = useUiPrefs((s) => s.toggleLevel);
  const selected = level.volumes.find((v) => v.id === selectedId) ?? null;
  const locked = level.locked;
  const dressables = level.volumes.filter((v) => DRESS_ROLES.includes(v.role));
  const anyDressing = dressables.some((v) => v.status && v.status !== "empty");
  const solids = level.volumes.filter((v) => v.role !== "spawn" && v.role !== "objective");
  const isBlank = solids.length === 0;

  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const [liveOk, setLiveOk] = useState<boolean | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    isLiveAvailable().then((ok) => {
      if (!cancelled) setLiveOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const vols = q
      ? level.volumes.filter(
          (v) =>
            v.label.toLowerCase().includes(q) ||
            v.role.includes(q) ||
            v.id.toLowerCase().includes(q),
        )
      : level.volumes;
    return ROLE_ORDER.map((role) => ({
      role,
      items: vols.filter((v) => v.role === role),
    })).filter((g) => g.items.length > 0);
  }, [level.volumes, query]);

  const generating =
    selected?.status === "queued" || selected?.status === "generating" || regenBusy || photoBusy;

  const canRegen =
    selected != null && DRESS_ROLES.includes(selected.role) && liveOk === true && !generating;

  const regenTitle =
    liveOk === false
      ? "needs Hyper3D connection"
      : liveOk === null
        ? "Checking Hyper3D…"
        : !selected || !DRESS_ROLES.includes(selected.role)
          ? "Select a dressable volume"
          : generating
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

  const onFromPhoto = async (file: File | undefined) => {
    if (!file || !selected || !canRegen) return;
    setPhotoBusy(true);
    setRegenError(null);
    try {
      await regenerateFromImage(selected.id, await toJpegDataUrl(file));
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <aside className={`level-panel${levelOpen ? "" : " level-panel--collapsed"}`}>
      <header className="panel-head">
        <div className="panel-head-row">
          <h1 className="panel-title">Level</h1>
          <button
            type="button"
            className="icon-btn level-collapse"
            onClick={toggleLevel}
            title={levelOpen ? "Hide level panel" : "Show level panel"}
            aria-expanded={levelOpen}
          >
            {levelOpen ? <PanelLeftClose {...ICON} aria-hidden /> : <PanelLeftOpen {...ICON} aria-hidden />}
            <span className="sr-only">{levelOpen ? "Hide level panel" : "Show level panel"}</span>
          </button>
        </div>
        {levelOpen && <span className="panel-subtitle mono">{level.name}</span>}
      </header>
      {!levelOpen && (
        <button type="button" className="level-rail-label" onClick={toggleLevel}>
          Level
        </button>
      )}
      {levelOpen && (
      <>
      <div className="field map-size-field">
        <span className="field-label">Map size</span>
        {suggestedBounds && suggestedBounds !== level.bounds && (
          <p className="map-size-suggest">Sketch needs {suggestedBounds * 2} m. The view already uses it; Accept keeps it.</p>
        )}
        <div className="map-size-picker" role="group" aria-label="Map size">
          {MAP_SIZES.map((size) => (
            <button
              key={size.id}
              type="button"
              className={
                suggestedBounds === size.bounds
                  ? "active map-size-suggested"
                  : level.bounds === size.bounds && !suggestedBounds
                    ? "active"
                    : ""
              }
              aria-pressed={suggestedBounds ? suggestedBounds === size.bounds : level.bounds === size.bounds}
              disabled={locked}
              title={locked ? "Unlock to resize the map" : size.label}
              onClick={() => {
                const result = setMapBounds(size.bounds);
                if (!result.ok) setToast(result.why ?? "Could not resize the map.", "error");
              }}
            >
              <strong>{size.label.split(" · ")[0]}</strong>
              <span>{size.bounds * 2} m</span>
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field-label">Preset</span>
        <select
          value={level.id}
          onChange={(e) => loadPreset(e.target.value)}
          disabled={locked}
          title={locked ? "Unlock to switch preset" : undefined}
        >
          {!PRESETS.some((p) => p.id === level.id) && <option value={level.id}>Custom</option>}
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <EditTools />

      <div className="side-section">
        <div className="section-row">
          <h2>Boxes</h2>
          <span className="muted mono">{level.volumes.length}</span>
        </div>
        {isBlank && (
          <p className="empty-state">
            <strong>Empty level</strong>
            Start from a sketch in the Co-designer, a preset, or Add a box.
          </p>
        )}
        {!isBlank && (
          <label className="search-wrap">
            <Search {...ICON} aria-hidden className="search-icon" />
            <input
              className="search-input"
              type="search"
              placeholder="Search boxes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        <div className="role-groups">
          {grouped.map(({ role, items }) => (
            <div key={role} className="role-group">
              <div className="role-group-head">
                <span className="vol-swatch" style={{ background: ROLE_COLORS[role] }} />
                <span className="role-group-name">{role}</span>
                <span className="role-group-count mono">{items.length}</span>
              </div>
              <ul className="vol-list">
                {items.map((v) => (
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
                      <span className="vol-row-role mono">
                        {v.size[0].toFixed(1)}×{v.size[1].toFixed(1)}×{v.size[2].toFixed(1)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {grouped.length === 0 && searching && (
            <p className="empty-state">
              <strong>No matches</strong>
              Nothing matches “{query.trim()}”. Try another name or role.
            </p>
          )}
        </div>
      </div>

      {locked && (
        <div className="side-section">
          <h2>Dress progress</h2>
          {dressables.length === 0 ? (
            <p className="empty-state">
              <strong>Nothing to dress</strong>
              Unlock and add cover, buildings, landmarks, or props first.
            </p>
          ) : !anyDressing ? (
            <p className="empty-state">
              <strong>No models yet</strong>
              Use <em>Dress level</em> in the action bar to generate looks.
            </p>
          ) : (
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
          )}
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
                {ROLE_ORDER.map((r) => (
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
                ({selected.position[0].toFixed(1)}, {selected.position[1].toFixed(1)},{" "}
                {selected.position[2].toFixed(1)})
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
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    void onFromPhoto(f);
                  }}
                />
                <div className="regen-row">
                  <button
                    type="button"
                    className="regen-btn icon-inline"
                    onClick={onRegenerate}
                    disabled={!canRegen}
                    title={regenTitle}
                  >
                    {generating && !photoBusy ? (
                      <span className="regen-spin" aria-hidden />
                    ) : (
                      <RefreshCw {...ICON} aria-hidden />
                    )}
                    {regenBusy || (generating && !photoBusy) ? "Regenerating…" : "Regenerate"}
                  </button>
                  <button
                    type="button"
                    className="regen-btn regen-btn--photo icon-inline"
                    onClick={() => photoRef.current?.click()}
                    disabled={!canRegen}
                    title={
                      liveOk === false
                        ? "needs Hyper3D connection"
                        : "Image-to-3D from a photo of this object (~2 min, 0.5 credits)"
                    }
                  >
                    {photoBusy ? <span className="regen-spin" aria-hidden /> : <Camera {...ICON} aria-hidden />}
                    {photoBusy ? "Generating…" : "From photo…"}
                  </button>
                </div>
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
          <p className="muted">Select a box in the viewport or list.</p>
        )}
      </div>
      </>
      )}
    </aside>
  );
}
