import type { Level } from "../core/types";
import { DRESS_ROLES } from "../core/types";
import * as store from "../core/store";

/** Pipeline steps — matches DESIGN_BRIEF §2 / C9 `currentStep` contract. */
export type WorkflowStep = "block-out" | "prove" | "lock" | "dress" | "play";

export const WORKFLOW_STEPS: { id: WorkflowStep; label: string; short: string }[] = [
  { id: "block-out", label: "Block out", short: "Block out" },
  { id: "prove", label: "Prove", short: "Prove" },
  { id: "lock", label: "Lock", short: "Lock" },
  { id: "dress", label: "Dress", short: "Dress" },
  { id: "play", label: "Play & share", short: "Play" },
];

/** Local derivation until C9 exports `currentStep` from the store. */
export function deriveCurrentStep(level: Level): WorkflowStep {
  if (level.locked) {
    const dressables = level.volumes.filter((v) => DRESS_ROLES.includes(v.role));
    const anyReady = dressables.some((v) => v.status === "ready" && v.assetUrl);
    return anyReady ? "play" : "dress";
  }
  if (level.prove?.status === "pass") return "lock";
  if (level.prove?.status === "fail") return "prove";
  const solids = level.volumes.filter((v) => v.role !== "spawn" && v.role !== "objective");
  if (solids.length > 0) return "prove";
  return "block-out";
}

/** Prefer store helper when Claude Code lands C9; otherwise local derivation. */
export function currentStep(level: Level): WorkflowStep {
  const fromStore = (store as { currentStep?: (l: Level) => WorkflowStep }).currentStep;
  if (typeof fromStore === "function") return fromStore(level);
  return deriveCurrentStep(level);
}

export function stepIndex(step: WorkflowStep): number {
  return WORKFLOW_STEPS.findIndex((s) => s.id === step);
}

/** Why a step can't be opened yet (empty string = allowed). */
export function stepBlockedReason(level: Level, step: WorkflowStep): string {
  switch (step) {
    case "block-out":
    case "prove":
      return "";
    case "lock":
      if (level.locked) return "";
      if (level.prove?.status !== "pass") return "Run Prove and get a pass first";
      return "";
    case "dress":
      if (!level.locked) return "Lock the layout after a passing Prove";
      return "";
    case "play":
      if (!level.locked) return "Lock the layout before play & share";
      return "";
    default:
      return "";
  }
}

export function canVisitStep(level: Level, step: WorkflowStep): boolean {
  return stepBlockedReason(level, step) === "";
}

/** Greybox = drafting look (blueprint grid) until dressed models appear. */
export function isGreybox(level: Level): boolean {
  return !level.volumes.some((v) => v.status === "ready" && !!v.assetUrl);
}
