import type { Level } from "../core/types";
import {
  STEPS,
  canEnterStep,
  currentStep as storeCurrentStep,
  type Step,
} from "../core/store";

/** Pipeline step — matches C9 store contract (`blockout`, not `block-out`). */
export type WorkflowStep = Step;

export const WORKFLOW_STEPS: { id: WorkflowStep; label: string; short: string }[] = STEPS.map((s) => ({
  id: s.id,
  label: s.label,
  short: s.id === "play" ? "Play" : s.label,
}));

export function currentStep(level: Level): WorkflowStep {
  return storeCurrentStep(level);
}

export function stepIndex(step: WorkflowStep): number {
  return WORKFLOW_STEPS.findIndex((s) => s.id === step);
}

/** Why a step can't be opened yet (empty string = allowed). */
export function stepBlockedReason(level: Level, step: WorkflowStep): string {
  const gate = canEnterStep(level, step);
  return gate.ok ? "" : (gate.why ?? "Not available yet");
}

export function canVisitStep(level: Level, step: WorkflowStep): boolean {
  return canEnterStep(level, step).ok;
}

/** Greybox = drafting look (blueprint grid) until dressed models appear. */
export function isGreybox(level: Level): boolean {
  return !level.volumes.some((v) => v.status === "ready" && !!v.assetUrl);
}
