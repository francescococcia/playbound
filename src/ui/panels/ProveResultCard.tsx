import { Check, HelpCircle, Sparkles, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { aiAgent, isAiAvailable } from "../../core/ai/client";
import { MIN_COVERED_PATH_FRACTION } from "../../core/prove/constants";
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
  const setCoDesignerOpen = useUiPrefs((s) => s.setCoDesignerOpen);
  const fixBusy = usePlaybound((s) => s.agentThread.some((m) => m.pending));
  const reduce = useReducedMotion();
  const step = stepOverride ?? currentStep(level);

  const [aiOk, setAiOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isAiAvailable().then((ok) => {
      if (!cancelled) setAiOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (step !== "prove" && step !== "lock") return null;
  if (!prove || prove.status === "idle") return null;
  if (viewMode === "fps") return null;

  const tone = prove.status === "pass" ? "pass" : "fail";
  const pct =
    prove.coveredFraction != null ? `${Math.round(prove.coveredFraction * 100)}%` : "—";
  const exposed =
    prove.exposedMeters != null ? `${prove.exposedMeters.toFixed(0)} m` : "—";
  const showFix = prove.status === "fail" && !locked;
  const fraction = Math.min(1, Math.max(0, prove.coveredFraction ?? 0));

  // Both answers land in the Co-designer conversation (the AI's one home).
  const ask = (q: string) => {
    if (fixBusy || aiOk === false) return;
    setCoDesignerOpen(true);
    aiAgent(q);
  };

  return (
    <motion.div
      key={prove.checkedAt}
      className={`prove-result-card prove-result-card--${tone}`}
      role="status"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={
        reduce
          ? { opacity: 1 }
          : tone === "fail"
            ? { opacity: 1, y: 0, x: [0, -7, 6, -4, 2, 0] }
            : { opacity: 1, y: 0, boxShadow: ["0 0 0 0 #3ddc9700", "0 0 0 8px #3ddc9733", "0 0 0 0 #3ddc9700"] }
      }
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], x: { delay: 0.2, duration: 0.45 } }}
    >
      <div className="prove-result-head">
        <span className="prove-result-status">
          <span className="prove-result-icon" aria-hidden>
            {prove.status === "pass" ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
          </span>
          {prove.status === "pass" ? "Pass" : "Fail"}
        </span>
        <span className="prove-result-kicker">Prove</span>
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

      {prove.coveredFraction != null && (
        <div className="prove-meter" aria-hidden>
          <div className="prove-meter-fill" style={{ transform: `scaleX(${fraction})` }} />
          <div className="prove-meter-goal" style={{ left: `${MIN_COVERED_PATH_FRACTION * 100}%` }}>
            <span>{Math.round(MIN_COVERED_PATH_FRACTION * 100)}% needed</span>
          </div>
        </div>
      )}

      <p className="prove-result-msg">
        {prove.message ?? (prove.status === "pass" ? "Route is playable." : "Route needs more cover.")}
      </p>

      {showFix && (
        <div className="prove-result-actions">
          <button
            type="button"
            className="suggest-fix-btn"
            disabled={fixBusy || aiOk === false}
            title={aiOk === false ? "AI not configured" : "The Co-designer proposes cover, checked by Prove"}
            onClick={() => ask("Fix the death corridor")}
          >
            {fixBusy ? <span className="btn-spin" aria-hidden /> : <Sparkles size={14} strokeWidth={1.75} />} Suggest fix
          </button>
          <button
            type="button"
            className="why-btn"
            disabled={fixBusy || aiOk === false}
            title="Explain why it fails"
            onClick={() => ask("Why does it fail?")}
          >
            <HelpCircle size={14} strokeWidth={1.75} /> Why?
          </button>
        </div>
      )}
    </motion.div>
  );
}
