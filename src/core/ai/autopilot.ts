// Autopilot (Round 4 · C): "Build me a level" → layout → Prove → fix → lock → style → dress,
// ONE APPROVED STEP AT A TIME. The Co-designer drafts each step; nothing happens until the
// designer clicks the step's button (and, for AI proposals, Accepts it in the thread).
// Where we are is derived from the level + pending proposals (no state to drift), plus a few
// facts we must remember: which layout proposal is ours, whether it was accepted, and whether
// a style was chosen for the NEW layout (the old level's style notes don't count).
import { create } from "zustand";
import { dressLevel } from "../dress/dress";
import { usePlaybound } from "../store";
import { DRESS_ROLES, type Level, type Proposal } from "../types";
import { aiAgent } from "./client";

export type ApStep = "layout" | "prove" | "fix" | "lock" | "style" | "dress" | "done";

export const AP_STEPS: { id: Exclude<ApStep, "done">; label: string }[] = [
  { id: "layout", label: "Layout" },
  { id: "prove", label: "Prove" },
  { id: "fix", label: "Fix" },
  { id: "lock", label: "Lock" },
  { id: "style", label: "Style" },
  { id: "dress", label: "Dress" },
];

export interface ApState {
  active: boolean;
  brief: string;
  /** Optional map / sketch: the layout is read from it (the brief becomes directions). */
  image: File | null;
  /** The layout proposal the autopilot asked for (while it is pending). */
  layoutProposalId: string | null;
  layoutAccepted: boolean;
  /** A style (notes or reference) was set after our layout was accepted. */
  styleSet: boolean;
  /** Prove failed at least once during this run (so "Fix" was really needed). */
  sawFail: boolean;
  busy: boolean;
}

export interface ApView {
  now: ApStep;
  /** True while a proposal for this step waits for Accept / Dismiss in the thread. */
  waiting: boolean;
  /** Button label for approving the next step (absent while waiting or done). */
  action?: string;
  /** One line: what this step does / what to do now. */
  hint: string;
}

/** Pure: the current step and what the designer can approve next. */
export function autopilotView(level: Level, proposals: Proposal[], ap: Pick<ApState, "layoutProposalId" | "layoutAccepted" | "styleSet" | "brief"> & { image?: File | null }): ApView {
  const layoutPending = !!ap.layoutProposalId && proposals.some((p) => p.id === ap.layoutProposalId);
  if (!ap.layoutAccepted) {
    return layoutPending
      ? { now: "layout", waiting: true, hint: "Preview the draft layout in the thread, then Accept it (or Dismiss and redraft)." }
      : { now: "layout", waiting: false, action: ap.layoutProposalId === null ? "Draft the layout" : "Redraft the layout", hint: ap.image ? `I'll read the greybox from ${ap.image.name}${ap.brief ? `, following: "${ap.brief}"` : ""}.` : `I'll draft a greybox for "${ap.brief}".` };
  }
  const prove = level.prove?.status;
  if (!prove || prove === "idle") return { now: "prove", waiting: false, action: "Run Prove", hint: "A bot walks from spawn to goal and checks it can stay hidden." };
  if (prove === "fail") {
    const fixPending = proposals.some((p) => p.source === "fix" || (p.source === "text" && !!(p.add?.length || p.update?.length)));
    return fixPending
      ? { now: "fix", waiting: true, hint: "Accept the fix in the thread: Prove re-runs straight away." }
      : { now: "fix", waiting: false, action: "Ask for a fix", hint: "Prove failed. I'll place cover that our Prove checks before you see it." };
  }
  if (!level.locked) return { now: "lock", waiting: false, action: "Lock the layout", hint: "Prove passed. Locking freezes the boxes so the art can't break the gameplay." };
  if (!ap.styleSet || (!level.styleNotes?.trim() && !level.styleRefUrl)) {
    const stylePending = proposals.some((p) => !!p.styleNotes);
    return stylePending
      ? { now: "style", waiting: true, hint: "Accept the style notes in the thread (they go into every 3D prompt)." }
      : { now: "style", waiting: false, action: "Suggest a style", hint: "I'll write art direction that fits your level." };
  }
  const dressable = level.volumes.filter((v) => DRESS_ROLES.includes(v.role));
  if (dressable.some((v) => v.status !== "ready")) {
    const running = dressable.some((v) => v.status === "queued" || v.status === "generating");
    return running
      ? { now: "dress", waiting: true, hint: "Hyper3D is making the models, each fitted inside its box (~2 min)." }
      : { now: "dress", waiting: false, action: "Dress the level", hint: "Hyper3D Rodin makes a 3D model for every box, sized to the box." };
  }
  return { now: "done", waiting: false, hint: "Done: your level is proven, locked and dressed. Play it or share the play link." };
}

export const useAutopilot = create<ApState>(() => ({
  active: false,
  brief: "",
  image: null,
  layoutProposalId: null,
  layoutAccepted: false,
  styleSet: false,
  sawFail: false,
  busy: false,
}));

/** Start a run from a one-line brief and/or a map. Drafts nothing yet: the first step needs approval too. */
export function startAutopilot(brief: string, image: File | null = null): void {
  useAutopilot.setState({ active: true, brief: brief.trim().slice(0, 300), image, layoutProposalId: null, layoutAccepted: false, styleSet: false, sawFail: false, busy: false });
}

export function stopAutopilot(): void {
  useAutopilot.setState({ active: false, busy: false });
}

/** Run the step the designer just approved. */
export async function approveAutopilotStep(): Promise<void> {
  const ap = useAutopilot.getState();
  const st = usePlaybound.getState();
  const view = autopilotView(st.level, st.proposals, ap);
  if (!ap.active || ap.busy || view.waiting || !view.action) return;
  useAutopilot.setState({ busy: true });
  try {
    switch (view.now) {
      case "layout": {
        const ps = ap.image
          ? await aiAgent(ap.brief ? `Build this level from the map. ${ap.brief}` : "Build this level from the map.", ap.image, { intent: "sketch" })
          : await aiAgent(`Build me a level: ${ap.brief}`, undefined, { intent: "build" });
        const layout = ps.find((p) => p.replaceAll);
        useAutopilot.setState({ layoutProposalId: layout?.id ?? "" });
        break;
      }
      case "prove":
        st.runProve();
        break;
      case "fix":
        await aiAgent("Fix the death corridor", undefined, { intent: "fix" });
        break;
      case "lock":
        st.lock();
        break;
      case "style":
        await aiAgent(`Suggest a look for this level: ${ap.brief || st.level.name}`, undefined, { intent: "style" });
        break;
      case "dress":
        await dressLevel();
        break;
    }
  } finally {
    useAutopilot.setState({ busy: false });
  }
}

// Remember what the level can't tell us: our layout was accepted, a new style was chosen,
// Prove failed once.
usePlaybound.subscribe((s, prev) => {
  const ap = useAutopilot.getState();
  if (!ap.active) return;
  if (s.level.prove?.status === "fail" && !ap.sawFail) useAutopilot.setState({ sawFail: true });
  const styleChanged = s.level.styleNotes !== prev.level.styleNotes || s.level.styleRefUrl !== prev.level.styleRefUrl;
  if (ap.layoutAccepted && !ap.styleSet && styleChanged && s.level.id === prev.level.id) useAutopilot.setState({ styleSet: true });
  const id = ap.layoutProposalId;
  if (!id || ap.layoutAccepted || s.proposals === prev.proposals) return;
  const p = prev.proposals.find((x) => x.id === id);
  if (!p || s.proposals.some((x) => x.id === id)) return;
  // Gone from the list: accepted if its boxes are now the level, otherwise dismissed.
  const accepted = !!p.add?.length && p.add.every((v) => s.level.volumes.some((w) => w.id === v.id));
  // A layout read from a map brings the real place's look: that counts as the Style step.
  useAutopilot.setState(accepted ? { layoutAccepted: true, styleSet: !!p.styleNotes } : { layoutProposalId: "" });
});
