import { useEffect, useRef, useState } from "react";
import { aiSketch, aiStyle, isAiAvailable } from "../../core/ai/client";
import { dressLevel } from "../../core/dress/dress";
import { downloadLevelZip } from "../../core/export/exportLevel";
import { canDress, usePlaybound } from "../../core/store";
import { ROLE_COLORS, type Role } from "../../core/types";
import { shareUrl } from "../../core/share";
import { useUiPrefs } from "../uiPrefs";
import { viewGroundCenter } from "../viewPick";
import { currentStep, type WorkflowStep } from "../workflow";
import { ShareSaveMenu } from "./ShareSaveMenu";

const ADD_ROLES: Role[] = ["cover", "block", "landmark", "prop", "spawn", "objective"];

/**
 * Bottom-centre step action bar (DESIGN_BRIEF §2).
 * U17: shell + working primaries. U18: disabled reasons + Prove result card.
 */
export function StepActionBar() {
  const level = usePlaybound((s) => s.level);
  const runProve = usePlaybound((s) => s.runProve);
  const lock = usePlaybound((s) => s.lock);
  const unlock = usePlaybound((s) => s.unlock);
  const setViewMode = usePlaybound((s) => s.setViewMode);
  const setStyleRef = usePlaybound((s) => s.setStyleRef);
  const addVolume = usePlaybound((s) => s.addVolume);
  const newLevel = usePlaybound((s) => s.newLevel);
  const loadPreset = usePlaybound((s) => s.loadPreset);
  const stepOverride = useUiPrefs((s) => s.stepOverride);
  const setStepOverride = useUiPrefs((s) => s.setStepOverride);
  const setToast = useUiPrefs((s) => s.setToast);
  const setShowHeatmap = useUiPrefs((s) => s.setShowHeatmap);

  const step: WorkflowStep = stepOverride ?? currentStep(level);
  const [addOpen, setAddOpen] = useState(false);
  const [dressBusy, setDressBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [styleBusy, setStyleBusy] = useState(false);
  const [sketchBusy, setSketchBusy] = useState(false);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [notesDraft, setNotesDraft] = useState(level.styleNotes ?? "");
  const styleRef = useRef<HTMLInputElement>(null);
  const sketchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotesDraft(level.styleNotes ?? "");
  }, [level.id, level.styleNotes]);

  useEffect(() => {
    let cancelled = false;
    isAiAvailable().then((ok) => {
      if (!cancelled) setAiOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dressGate = canDress(level);
  const dressing = level.volumes.some((v) => v.status === "queued" || v.status === "generating");

  const onAdd = (role: Role) => {
    if (level.locked) return;
    const pos = viewGroundCenter();
    const lim = level.bounds - 1;
    addVolume(role, [
      Math.min(lim, Math.max(-lim, pos[0])),
      0,
      Math.min(lim, Math.max(-lim, pos[2])),
    ]);
    setAddOpen(false);
  };

  const onProve = () => {
    runProve();
    setShowHeatmap(true);
    setStepOverride("prove");
  };

  const onLock = () => {
    lock();
    setStepOverride("dress");
  };

  const onDress = async () => {
    if (!dressGate.ok || dressBusy) return;
    setDressBusy(true);
    try {
      await dressLevel();
      setToast("Dress finished.");
      setStepOverride("play");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setDressBusy(false);
    }
  };

  const onShare = async () => {
    try {
      const url = await shareUrl(level);
      await navigator.clipboard.writeText(url);
      setToast("Share link copied.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  };

  const onExport = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      await downloadLevelZip(level);
      setToast("Export downloaded.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  };

  const onStyleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setStyleRef(reader.result, notesDraft || level.styleNotes);
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="step-action-bar" data-step={step}>
      <input
        ref={styleRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          onStyleFile(f);
        }}
      />
      <input
        ref={sketchRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || level.locked || aiOk === false) return;
          setSketchBusy(true);
          void aiSketch(file)
            .then((out) => {
              if (out.note) setToast(out.note);
              else if (out.proposal) setToast("Sketch proposal ready — Accept or Reject.");
            })
            .catch((err) => setToast(err instanceof Error ? err.message : String(err)))
            .finally(() => setSketchBusy(false));
        }}
      />

      {step === "block-out" && (
        <>
          <div className="add-wrap action-primary-wrap">
            <button
              type="button"
              className="btn-primary"
              disabled={level.locked}
              title={level.locked ? "Unlock to edit boxes" : "Add a box at the view centre"}
              onClick={() => setAddOpen((o) => !o)}
            >
              Add box ▾
            </button>
            {addOpen && !level.locked && (
              <ul className="add-menu" role="menu">
                {ADD_ROLES.map((role) => (
                  <li key={role}>
                    <button type="button" role="menuitem" onClick={() => onAdd(role)}>
                      <span className="vol-swatch" style={{ background: ROLE_COLORS[role] }} />
                      {role}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            disabled={level.locked || aiOk === false || sketchBusy}
            title={
              level.locked
                ? "Unlock to replace the layout"
                : aiOk === false
                  ? "AI not configured"
                  : "Upload a sketch → greybox proposal"
            }
            onClick={() => sketchRef.current?.click()}
          >
            {sketchBusy ? "Reading sketch…" : "Sketch → level"}
          </button>
          <button
            type="button"
            disabled={level.locked}
            title={level.locked ? "Unlock to switch preset" : "Load Market Square (fail)"}
            onClick={() => loadPreset("market-square-fail")}
          >
            Preset
          </button>
          <button
            type="button"
            disabled={level.locked}
            title={level.locked ? "Unlock to edit" : "Blank level"}
            onClick={() => {
              if (!window.confirm("Start a blank level? Unsaved layout changes will be lost.")) return;
              newLevel();
            }}
          >
            New
          </button>
        </>
      )}

      {step === "prove" && (
        <button type="button" className="btn-primary" onClick={onProve}>
          Run Prove
        </button>
      )}

      {step === "lock" &&
        (level.locked ? (
          <button type="button" className="btn-primary" onClick={unlock}>
            Unlock layout
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={level.prove?.status !== "pass"}
            title={
              level.prove?.status !== "pass"
                ? "Need a passing Prove before lock"
                : "Boxes can't move after this; the AI can only change looks"
            }
            onClick={onLock}
          >
            Lock layout
          </button>
        ))}

      {step === "dress" && (
        <>
          <button
            type="button"
            title="Style reference image"
            disabled={styleBusy}
            onClick={() => styleRef.current?.click()}
          >
            {styleBusy ? "Reading…" : level.styleRefUrl ? "Style image ✓" : "Style image"}
          </button>
          <input
            className="style-notes-inline"
            type="text"
            value={notesDraft}
            placeholder="Style notes…"
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => setStyleRef(level.styleRefUrl, notesDraft)}
          />
          <button
            type="button"
            className="btn-primary btn-with-spin"
            onClick={onDress}
            disabled={!dressGate.ok || dressBusy}
            title={dressGate.ok ? "Dress locked volumes" : dressGate.why}
          >
            {(dressBusy || dressing) && <span className="btn-spin" aria-hidden />}
            {dressBusy || dressing ? "Dressing…" : "Dress level"}
          </button>
        </>
      )}

      {step === "play" && (
        <>
          <button type="button" className="btn-primary" onClick={() => setViewMode("fps")}>
            Walk (FPS)
          </button>
          <button type="button" onClick={onShare}>
            Share link
          </button>
          <button type="button" className="btn-with-spin" onClick={onExport} disabled={exportBusy}>
            {exportBusy && <span className="btn-spin" aria-hidden />}
            {exportBusy ? "Exporting…" : "Export zip"}
          </button>
          <ShareSaveMenu onToast={setToast} />
        </>
      )}
    </div>
  );
}
