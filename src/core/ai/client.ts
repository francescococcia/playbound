// Browser client for the AI co-designer. Each call asks /api/ai/<action>, and on success
// puts the returned Proposal into the store as a ghost. The designer Accepts or Rejects it.
// Calls take ~5-30 s (Gemini). They throw Error(message) for the UI to show as a toast.
import { toJpegDataUrl as toDataUrl } from "../image";
import { usePlaybound } from "../store";
import type { Proposal } from "../types";
import type { AgentResponse, AiHealth, AiResponse } from "./types";

export interface AiOutcome {
  proposal?: Proposal;
  /** Set when the AI had nothing to propose (e.g. "already passes"). Show as info toast. */
  note?: string;
  model?: string;
}

let health: Promise<AiHealth> | undefined;
/** True when an AI key is configured on the server (dev or deployed). */
export async function isAiAvailable(): Promise<boolean> {
  health ??= fetch("/api/ai/health")
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .catch(() => ({ ai: false }));
  return (await health).ai;
}

/** Sketch / map / screenshot → a whole greybox layout (replaces the level on Accept). */
export async function aiSketch(image: File | string): Promise<AiOutcome> {
  return call("sketch", { image: await toDataUrl(image) });
}

/** Reference picture → style notes for every Rodin prompt (applies even when locked). */
export async function aiStyle(image: File | string): Promise<AiOutcome> {
  return call("style", { image: await toDataUrl(image) });
}

/** Natural-language edit, e.g. "add a fountain near the well". */
export async function aiCommand(text: string): Promise<AiOutcome> {
  return call("command", { text, level: usePlaybound.getState().level });
}

/** Failing level → one cover box that makes Prove pass (verified server-side). */
export async function aiSuggestFix(): Promise<AiOutcome> {
  return call("fix", { level: usePlaybound.getState().level });
}

async function call(action: string, body: unknown): Promise<AiOutcome> {
  const r = await fetch(`/api/ai/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json().catch(() => ({ error: `AI request failed (HTTP ${r.status})` }))) as AiResponse;
  if (!r.ok || j.error) throw new Error(j.error ?? `AI request failed (HTTP ${r.status})`);
  if (j.proposal) usePlaybound.getState().addProposal(j.proposal);
  return { proposal: j.proposal, note: j.note, model: j.model };
}

// ---- Round 3: the Co-designer agent ----

const mid = () => `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * Talk to the Co-designer. Adds the user bubble and a pending agent bubble to
 * `agentThread`, then fills the agent bubble with the reply, its proposals (as ghosts in
 * `proposals`) and follow-up chips. Errors land in the bubble's `error` (no throw).
 * `image`: a sketch (→ layout) or a picture (→ style); the agent decides which.
 */
export async function aiAgent(message: string, image?: File | string, opts: { intent?: AgentResponse["intent"] } = {}): Promise<AgentResponse["proposals"]> {
  const st = usePlaybound.getState();
  const history = st.agentThread
    .filter((m) => !m.pending && !m.error && m.text)
    .slice(-6)
    .map((m) => ({ role: m.role, text: m.text }));
  const img = image ? await toDataUrl(image) : undefined;
  st.pushAgentMessage({ id: mid(), role: "user", text: message, imageThumb: img ? await toDataUrl(img, 160) : undefined });
  const replyId = mid();
  st.pushAgentMessage({ id: replyId, role: "agent", text: "", pending: true });
  try {
    const r = await fetch("/api/ai/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, image: img, level: usePlaybound.getState().level, history, intent: opts.intent }),
    });
    const j = (await r.json().catch(() => ({ error: `AI request failed (HTTP ${r.status})` }))) as Partial<AgentResponse> & { error?: string };
    if (!r.ok || j.error) throw new Error(j.error ?? `AI request failed (HTTP ${r.status})`);
    for (const p of j.proposals ?? []) usePlaybound.getState().addProposal(p);
    usePlaybound.getState().updateAgentMessage(replyId, {
      pending: false,
      text: j.reply ?? "",
      proposalIds: (j.proposals ?? []).map((p) => p.id),
      chips: j.chips ?? [],
      intent: j.intent,
      model: j.model,
    });
    return j.proposals ?? [];
  } catch (e) {
    usePlaybound.getState().updateAgentMessage(replyId, { pending: false, error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}
