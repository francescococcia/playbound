import { useEffect, useRef, useState } from "react";
import { aiStyle } from "../../core/ai/client";
import { canDress, usePlaybound } from "../../core/store";
import { dressLevel } from "../../core/dress/dress";
import { downloadLevelZip } from "../../core/export/exportLevel";
import { useUiPrefs } from "../uiPrefs";
import { ShareSaveMenu } from "./ShareSaveMenu";

export function TopBar() {
  const level = usePlaybound((s) => s.level);
  const viewMode = usePlaybound((s) => s.viewMode);
  const setViewMode = usePlaybound((s) => s.setViewMode);
  const runProve = usePlaybound((s) => s.runProve);
  const lock = usePlaybound((s) => s.lock);
  const unlock = usePlaybound((s) => s.unlock);
  const setStyleRef = usePlaybound((s) => s.setStyleRef);
  const panelOpen = useUiPrefs((s) => s.panelOpen);
  const togglePanel = useUiPrefs((s) => s.togglePanel);
  const setPanelOpen = useUiPrefs((s) => s.setPanelOpen);
  const toast = useUiPrefs((s) => s.toast);
  const setToast = useUiPrefs((s) => s.setToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dressBusy, setDressBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [styleBusy, setStyleBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState(level.styleNotes ?? "");

  useEffect(() => {
    setNotesDraft(level.styleNotes ?? "");
  }, [level.id, level.styleNotes]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 761px)");
    const onChange = () => {
      if (mq.matches) setPanelOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setPanelOpen]);

  const dressGate = canDress(level);
  const dressing = level.volumes.some((v) => v.status === "queued" || v.status === "generating");

  const onStyleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setStyleRef(reader.result, notesDraft || level.styleNotes);
    };
    reader.readAsDataURL(file);
    // Also ask AI for style notes (proposal — designer must Accept).
    setStyleBusy(true);
    setToast("Reading style… ~5–10 s");
    void aiStyle(file)
      .then((out) => {
        if (out.note) setToast(out.note);
        else if (out.proposal) setToast("Style notes proposal ready — Accept or Reject.");
      })
      .catch((e) => setToast(e instanceof Error ? e.message : String(e)))
      .finally(() => setStyleBusy(false));
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

  const onExport = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    setToast(null);
    try {
      await downloadLevelZip(level);
      setToast("Export downloaded.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <header className="top-bar">
      <strong className="brand">PLAYBOUND</strong>

      <button
        type="button"
        className={`panel-toggle${panelOpen ? " active" : ""}`}
        aria-expanded={panelOpen}
        onClick={togglePanel}
        title="Toggle side panel"
      >
        {panelOpen ? "Close" : "Panel"}
      </button>

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
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            onStyleFile(f);
          }}
        />
        <button
          type="button"
          className="style-thumb-btn"
          onClick={() => fileRef.current?.click()}
          title="Style reference image (+ AI style notes proposal)"
          disabled={styleBusy}
        >
          {styleBusy ? (
            <span className="btn-spin" aria-hidden />
          ) : level.styleRefUrl ? (
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
          className="btn-with-spin"
          onClick={onDress}
          disabled={!dressGate.ok || dressBusy}
          title={dressGate.ok ? (dressBusy ? "Dressing…" : "Dress locked volumes") : dressGate.why}
        >
          {(dressBusy || dressing) && <span className="btn-spin" aria-hidden />}
          {dressBusy || dressing ? "Dressing…" : "Dress"}
        </button>
        <button
          type="button"
          className="btn-with-spin"
          onClick={onExport}
          disabled={exportBusy}
          title={exportBusy ? "Building zip…" : "Download level.json + GLBs as zip"}
        >
          {exportBusy && <span className="btn-spin" aria-hidden />}
          {exportBusy ? "Exporting…" : "Export"}
        </button>
        <ShareSaveMenu onToast={setToast} />
      </div>

      {toast && (
        <button type="button" className="top-toast" onClick={() => setToast(null)} title="Dismiss">
          {toast}
        </button>
      )}
    </header>
  );
}
