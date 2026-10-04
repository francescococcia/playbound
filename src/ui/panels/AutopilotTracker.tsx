// Autopilot (Round 4 · C) inside the Co-designer: "Build me a level" from one line, then
// layout → Prove → fix → lock → style → dress, each step only after the designer approves it.
// Owned by Claude Code. Logic lives in src/core/ai/autopilot.ts (tested).
import { Check, Loader2, Wand2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AP_STEPS, approveAutopilotStep, autopilotView, startAutopilot, stopAutopilot, useAutopilot } from "../../core/ai/autopilot";
import { usePlaybound } from "../../core/store";
import "./autopilot.css";

const EXAMPLES = ["a smugglers' harbour at night", "a walled monastery courtyard", "a desert bazaar with a well"];

export function AutopilotTracker({ aiOk }: { aiOk: boolean }) {
  const ap = useAutopilot();
  const level = usePlaybound((s) => s.level);
  const proposals = usePlaybound((s) => s.proposals);
  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!ap.active) {
    const submit = (e: FormEvent) => {
      e.preventDefault();
      if (brief.trim()) startAutopilot(brief);
    };
    return (
      <form className="ap-start" onSubmit={submit}>
        <label className="ap-start-label" htmlFor="ap-brief">
          <Wand2 size={14} strokeWidth={1.75} aria-hidden /> Build me a level
        </label>
        <div className="ap-start-row">
          <input
            id="ap-brief"
            className="ap-start-input"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={`e.g. ${EXAMPLES[0]}`}
            disabled={!aiOk}
          />
          <button type="submit" className="co-guide-primary" disabled={!aiOk || !brief.trim()}>
            Start
          </button>
        </div>
        {!aiOk && <p className="ap-note">Needs the AI connection.</p>}
      </form>
    );
  }

  const view = autopilotView(level, proposals, ap);
  const order = AP_STEPS.map((s) => s.id);
  const nowIdx = view.now === "done" ? order.length : order.indexOf(view.now);
  const approve = () => {
    setError(null);
    approveAutopilotStep().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  return (
    <section className="co-guide ap" aria-label="Autopilot">
      <div className="ap-head">
        <span className="co-guide-step">
          Autopilot · <span className="ap-brief">{ap.brief}</span>
        </span>
        <button type="button" className="ap-stop" onClick={stopAutopilot} title="Stop the autopilot" aria-label="Stop the autopilot">
          <X size={14} />
        </button>
      </div>
      <ol className="ap-steps">
        {AP_STEPS.map((s, i) => {
          const skipped = s.id === "fix" && i < nowIdx && !ap.sawFail;
          const state = i < nowIdx ? "done" : i === nowIdx ? "now" : "todo";
          return (
            <li key={s.id} className={`ap-step ap-step--${skipped ? "skipped" : state}`} title={skipped ? "Not needed: Prove passed first time" : undefined}>
              <span className="ap-dot">{state === "done" && !skipped ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
              {s.label}
            </li>
          );
        })}
      </ol>
      <div className="co-guide-body">
        <p className="co-guide-do">{view.hint}</p>
        {view.action && (
          <div className="co-guide-actions">
            <button type="button" className="co-guide-primary" disabled={ap.busy} onClick={approve}>
              {ap.busy ? <Loader2 size={14} className="ap-spin" /> : <Check size={14} />}
              {ap.busy ? "Working…" : `Approve: ${view.action}`}
            </button>
          </div>
        )}
        {view.waiting && <p className="co-guide-expect">Waiting for you ↓</p>}
        {error && <p className="ap-error">{error}</p>}
      </div>
    </section>
  );
}
