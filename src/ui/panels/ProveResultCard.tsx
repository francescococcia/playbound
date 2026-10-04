import { useEffect, useState } from "react";
import { aiSuggestFix, isAiAvailable } from "../../core/ai/client";
import { usePlaybound } from "../../core/store";
import { useUiPrefs } from "../uiPrefs";
import { currentStep } from "../workflow";

/** Prove pass/fail card with % protected and metres exposed (DESIGN_BRIEF §2). */
export function ProveResultCard() {
  const level = usePlaybound((s) => s.level);
  const prove = level.prove;
  const viewMode = usePlaybound((s) => s.viewMode);
  const locked = level.locked;
  const stepOverride = useUiPrefs((s) => s.stepOverride);
  const setToast = useUiPrefs((s) => s.setToast);
  const step = stepOverride ?? currentStep(level);

  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    isAiAvailable().then((ok) => {
      if (!cancelled) setAiOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fixBusy) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [fixBusy]);

  if (step !== "prove" && step !== "lock") return null;
  if (!prove || prove.status === "idle") return null;
  if (viewMode === "fps") return null;

  const tone = prove.status === "pass" ? "pass" : "fail";
  const pct =
    prove.coveredFraction != null ? `${Math.round(prove.coveredFraction * 100)}%` : "—";
  const exposed =
    prove.exposedMeters != null ? `${prove.exposedMeters.toFixed(0)} m` : "—";
  const showFix = prove.status === "fail" && !locked;

  const onFix = async () => {
    if (fixBusy || aiOk === false) return;
    setFixBusy(true);
    try {
      const out = await aiSuggestFix();
      if (out.note) setToast(out.note);
      else if (out.proposal) setToast("Fix proposal ready — Accept or Reject.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setFixBusy(false);
    }
  };

  return (
    <div className={`prove-result-card prove-result-card--${tone}`} role="status">
      <div className="prove-result-head">
        <span className="prove-result-status">{prove.status === "pass" ? "Pass" : "Fail"}</span>
        <span className="muted mono">Prove</span>
      </div>

      <div className="prove-result-stats">
        <div className="prove-stat">
          <div className="prove-stat-value mono">{pct}</div>
          <div className="prove-stat-label">protected</div>
        </div>
        <div className="prove-stat">
          <div className="prove-stat-value mono">{exposed}</div>
          <div className="prove-stat-label">exposed</div>
        </div>
      </div>

      <p className="prove-result-msg">
        {prove.message ?? (prove.status === "pass" ? "Route is playable." : "Route needs more cover.")}
      </p>

      {showFix && (
        <button
          type="button"
          className="suggest-fix-btn"
          disabled={fixBusy || aiOk === false}
          title={aiOk === false ? "AI not configured" : "Ask AI for cover that makes Prove pass"}
          onClick={onFix}
        >
          {fixBusy ? (
            <>
              <span className="btn-spin" aria-hidden /> Suggesting… ~5–10 s · {elapsed}s
            </>
          ) : (
            "Suggest fix"
          )}
        </button>
      )}
    </div>
  );
}
