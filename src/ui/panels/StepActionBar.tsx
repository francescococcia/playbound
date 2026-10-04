import {
  Download,
  Footprints,
  ImagePlus,
  Link2,
  Lock,
  Play,
  Plus,
  Unlock,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { aiSketch, aiStyle, isAiAvailable } from "../../core/ai/client";
import { dressLevel } from "../../core/dress/dress";
import { downloadLevelZip } from "../../core/export/exportLevel";
import { canDress, usePlaybound } from "../../core/store";
import { ROLE_COLORS, type Role } from "../../core/types";
import { shareUrl } from "../../core/share";
import { PRESETS } from "../../presets/marketSquare";
import { useUiPrefs } from "../uiPrefs";
import { viewGroundCenter } from "../viewPick";
import { currentStep, type WorkflowStep } from "../workflow";
import { ShareSaveMenu } from "./ShareSaveMenu";

const ADD_ROLES: Role[] = ["cover", "block", "landmark", "prop", "spawn", "objective"];
const ICON = { size: 16, strokeWidth: 1.75 } as const;

/** Bottom-centre step action bar — one primary action per step (DESIGN_BRIEF §2). */
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
  const [presetOpen, setPresetOpen] = useState(false);
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

  const lockDisabled = level.prove?.status !== "pass";
  const lockWhy = lockDisabled
    ? "Need a passing Prove first — then boxes can't move; the AI can only change looks"
    : "Boxes can't move after this; the AI can only change looks";

  const sketchDisabled = level.locked || aiOk === false || sketchBusy;
  const sketchWhy = level.locked
    ? "Unlock to replace the layout"
    : aiOk === false
      ? "AI not configured"
      : "Upload a sketch → greybox proposal";

  const dressDisabled = !dressGate.ok || dressBusy;
  const dressWhy = dressGate.ok ? "Generate looks for locked volumes" : dressGate.why;

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

      {step === "blockout" && (
        <>
          <div className="add-wrap action-primary-wrap">
            <button
              type="button"
              className="btn-primary icon-inline"
              disabled={level.locked}
              title={level.locked ? "Unlock to edit boxes" : "Add a box at the view centre"}
              onClick={() => setAddOpen((o) => !o)}
            >
              <Plus {...ICON} aria-hidden />
              Add box
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
            className="icon-inline"
            disabled={sketchDisabled}
            title={sketchWhy}
            onClick={() => sketchRef.current?.click()}
          >
            <ImagePlus {...ICON} aria-hidden />
            {sketchBusy ? "Reading sketch…" : "Sketch → level"}
          </button>
          <div className="add-wrap">
            <button
              type="button"
              disabled={level.locked}
              title={level.locked ? "Unlock to switch preset" : "Load a preset"}
              onClick={() => setPresetOpen((o) => !o)}
            >
              Presets
            </button>
            {presetOpen && !level.locked && (
              <ul className="add-menu" role="menu">
                {PRESETS.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        loadPreset(p.id);
                        setPresetOpen(false);
                        setStepOverride(null);
                      }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            disabled={level.locked}
            title={level.locked ? "Unlock to edit" : "Blank level"}
            onClick={() => {
              if (!window.confirm("Start a blank level? Unsaved layout changes will be lost.")) return;
              newLevel();
              setStepOverride("blockout");
            }}
          >
            New
          </button>
          {level.locked && <p className="action-why">Unlock to edit boxes</p>}
          {!level.locked && aiOk === false && <p className="action-why">AI not configured — Sketch is disabled</p>}
        </>
      )}

      {step === "prove" && (
        <button type="button" className="btn-primary icon-inline" onClick={onProve} title="Path + cover + line of sight from the objective">
          <Play {...ICON} aria-hidden />
          Run Prove
        </button>
      )}

      {step === "lock" &&
        (level.locked ? (
          <button type="button" className="btn-primary icon-inline" onClick={unlock} title="Allow moving boxes again">
            <Unlock {...ICON} aria-hidden />
            Unlock layout
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary icon-inline"
              disabled={lockDisabled}
              title={lockWhy}
              onClick={onLock}
            >
              <Lock {...ICON} aria-hidden />
              Lock layout
            </button>
            {lockDisabled && <p className="action-why">{lockWhy}</p>}
          </>
        ))}

      {step === "dress" && (
        <>
          <button
            type="button"
            className="icon-inline"
            title={styleBusy ? "Reading style…" : "Style reference image (+ AI notes proposal)"}
            disabled={styleBusy}
            onClick={() => styleRef.current?.click()}
          >
            <ImagePlus {...ICON} aria-hidden />
            {styleBusy ? "Reading…" : level.styleRefUrl ? "Style image ✓" : "Style image"}
          </button>
          <input
            className="style-notes-inline"
            type="text"
            value={notesDraft}
            placeholder="Style notes…"
            title="Style notes used in Dress prompts"
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => setStyleRef(level.styleRefUrl, notesDraft)}
          />
          <button
            type="button"
            className="btn-primary btn-with-spin icon-inline"
            onClick={onDress}
            disabled={dressDisabled}
            title={dressWhy}
          >
            {(dressBusy || dressing) && <span className="btn-spin" aria-hidden />}
            {dressBusy || dressing ? "Dressing…" : "Dress level"}
          </button>
          {dressDisabled && !dressBusy && <p className="action-why">{dressGate.why}</p>}
        </>
      )}

      {step === "play" && (
        <>
          <button
            type="button"
            className="btn-primary icon-inline"
            onClick={() => setViewMode("fps")}
            title="First-person walk from the spawn"
          >
            <Footprints {...ICON} aria-hidden />
            Walk (FPS)
          </button>
          <button type="button" className="icon-inline" onClick={onShare} title="Copy a share link to this level">
            <Link2 {...ICON} aria-hidden />
            Share link
          </button>
          <button
            type="button"
            className="btn-with-spin icon-inline"
            onClick={onExport}
            disabled={exportBusy}
            title={exportBusy ? "Building zip…" : "Download level.json + GLBs"}
          >
            {exportBusy ? <span className="btn-spin" aria-hidden /> : <Download {...ICON} aria-hidden />}
            {exportBusy ? "Exporting…" : "Export zip"}
          </button>
          <ShareSaveMenu onToast={setToast} />
        </>
      )}
    </div>
  );
}
