import { useEffect, useState } from "react";
import { deleteSave, listSaves, loadSave, saveLevel, shareUrl, type SaveEntry } from "../../core/share";
import { usePlaybound } from "../../core/store";

export function ShareSaveMenu({
  onToast,
}: {
  onToast: (msg: string) => void;
}) {
  const level = usePlaybound((s) => s.level);
  const setLevel = usePlaybound((s) => s.setLevel);
  const [open, setOpen] = useState(false);
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshSaves = () => setSaves(listSaves());

  useEffect(() => {
    if (open) refreshSaves();
  }, [open]);

  const onShare = async () => {
    setBusy(true);
    try {
      const url = await shareUrl(level);
      await navigator.clipboard.writeText(url);
      onToast("Share link copied.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => {
    const name = window.prompt("Save as", level.name);
    if (name === null) return;
    const ok = saveLevel({ ...level, name: name.trim() || level.name });
    refreshSaves();
    onToast(ok ? "Level saved in this browser." : "Could not save (storage blocked).");
  };

  const onLoad = (id: string) => {
    const next = loadSave(id);
    if (!next) {
      onToast("Save not found.");
      return;
    }
    setLevel(next);
    setOpen(false);
    onToast(`Loaded “${next.name}”.`);
  };

  const onDelete = (id: string) => {
    if (!window.confirm("Delete this save?")) return;
    deleteSave(id);
    refreshSaves();
    onToast("Save deleted.");
  };

  return (
    <>
      <button type="button" onClick={onShare} disabled={busy} title="Copy share link (#l=… in the URL)">
        {busy ? "Sharing…" : "Share"}
      </button>
      <div className="save-wrap">
        <button type="button" title="Save / Open levels in this browser" onClick={() => setOpen((o) => !o)}>
          Save ▾
        </button>
        {open && (
          <div className="save-menu">
            <button type="button" className="save-action" onClick={onSave}>
              Save current…
            </button>
            <div className="save-list-label">Open</div>
            {saves.length === 0 ? (
              <p className="muted">No saves yet.</p>
            ) : (
              <ul className="save-list">
                {saves.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="save-load" onClick={() => onLoad(s.id)}>
                      {s.name}
                      <span className="save-meta">
                        {s.volumes} boxes · {new Date(s.savedAt).toLocaleString()}
                      </span>
                    </button>
                    <button type="button" className="save-del" title="Delete" onClick={() => onDelete(s.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
