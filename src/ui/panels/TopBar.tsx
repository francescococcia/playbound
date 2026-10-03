import { useEffect, useRef, useState } from "react";
import { canDress, usePlaybound } from "../../core/store";
import { dressLevel } from "../../core/dress/dress";

export function TopBar() {
  const level = usePlaybound((s) => s.level);
  const viewMode = usePlaybound((s) => s.viewMode);
  const setViewMode = usePlaybound((s) => s.setViewMode);
  const runProve = usePlaybound((s) => s.runProve);
  const lock = usePlaybound((s) => s.lock);
  const unlock = usePlaybound((s) => s.unlock);
  const setStyleRef = usePlaybound((s) => s.setStyleRef);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dressBusy, setDressBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState(level.styleNotes ?? "");

  useEffect(() => {
    setNotesDraft(level.styleNotes ?? "");
  }, [level.id, level.styleNotes]);

  const dressGate = canDress(level);

  const onStyleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setStyleRef(reader.result, notesDraft || level.styleNotes);
    };
    reader.readAsDataURL(file);
  };

  const onDress = async () => {
    if (!dressGate.ok || dressBusy) return;
    setDressBusy(true);
    setToast(null);
    try {
      await dressLevel();
      setToast("Dress finished.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setDressBusy(false);
    }
  };

  return (
    <header className="top-bar">
      <strong className="brand">PLAYBOUND</strong>

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

      <div className="style-ref">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onStyleFile(e.target.files?.[0])}
        />
        <button type="button" className="style-thumb-btn" onClick={() => fileRef.current?.click()} title="Style reference image">
          {level.styleRefUrl ? (
            <img src={level.styleRefUrl} alt="Style ref" className="style-thumb" />
          ) : (
            <span className="style-thumb-empty">Style</span>
          )}
        </button>
        <input
          className="style-notes"
          type="text"
          value={notesDraft}
          placeholder="Style notes…"
          title="Style notes (used in Dress prompts)"
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => setStyleRef(level.styleRefUrl, notesDraft)}
        />
      </div>

      <span className="spacer" />

      <div className="top-actions">
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
        <button
          type="button"
          onClick={onDress}
          disabled={!dressGate.ok || dressBusy}
          title={dressGate.ok ? (dressBusy ? "Dressing…" : "Dress locked volumes") : dressGate.why}
        >
          {dressBusy ? "Dressing…" : "Dress"}
        </button>
        <button type="button" disabled title="Export comes in M4">
          Export
        </button>
        <button type="button" disabled title="Share comes in M4">
          Share
        </button>
      </div>

      {toast && (
        <button type="button" className="top-toast" onClick={() => setToast(null)} title="Dismiss">
          {toast}
        </button>
      )}
    </header>
  );
}
