import { Check } from "lucide-react";
import { usePlaybound } from "../../core/store";
import { useUiPrefs } from "../uiPrefs";
import {
  WORKFLOW_STEPS,
  canVisitStep,
  currentStep,
  stepBlockedReason,
  stepIndex,
  type WorkflowStep,
} from "../workflow";

export function Stepper() {
  const level = usePlaybound((s) => s.level);
  const stepOverride = useUiPrefs((s) => s.stepOverride);
  const setStepOverride = useUiPrefs((s) => s.setStepOverride);
  const suggested = currentStep(level);
  const active = stepOverride ?? suggested;
  const activeIdx = stepIndex(active);
  const suggestedIdx = stepIndex(suggested);

  const onPick = (step: WorkflowStep) => {
    if (!canVisitStep(level, step)) return;
    setStepOverride(step);
  };

  return (
    <header className="stepper">
      <strong className="brand">PLAYBOUND</strong>

      <nav className="stepper-track" aria-label="Level pipeline">
        <div
          className="stepper-progress"
          style={{
            width: `${(Math.max(suggestedIdx, 0) / (WORKFLOW_STEPS.length - 1)) * 100}%`,
          }}
          aria-hidden
        />
        {WORKFLOW_STEPS.map((s, i) => {
          const isCurrent = s.id === active;
          const isDone = i < suggestedIdx;
          const allowed = canVisitStep(level, s.id);
          const why = stepBlockedReason(level, s.id);

          return (
            <button
              key={s.id}
              type="button"
              className={[
                "stepper-step",
                isCurrent ? "stepper-step--current" : "",
                isDone ? "stepper-step--done" : "",
                !allowed ? "stepper-step--blocked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!allowed}
              title={why || s.label}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => onPick(s.id)}
            >
              <span className="stepper-num" aria-hidden>
                {isDone ? <Check size={14} strokeWidth={1.75} /> : i + 1}
              </span>
              <span className="stepper-label">{s.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="stepper-compact">
        Step {activeIdx + 1} of {WORKFLOW_STEPS.length}
        <span className="stepper-compact-name"> · {WORKFLOW_STEPS[activeIdx]?.short}</span>
      </div>
    </header>
  );
}
