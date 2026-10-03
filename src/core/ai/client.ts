// Browser client for the AI co-designer. Each call asks /api/ai/<action>, and on success
// puts the returned Proposal into the store as a ghost. The designer Accepts or Rejects it.
// Calls take ~5-30 s (Gemini). They throw Error(message) for the UI to show as a toast.
import { usePlaybound } from "../store";
import type { Proposal } from "../types";
import type { AiHealth, AiResponse } from "./types";

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

/** Downscale to ≤1024 px JPEG so uploads stay small (Vercel body limit, faster AI). */
async function toDataUrl(image: File | string, max = 1024): Promise<string> {
  const src = typeof image === "string" ? image : URL.createObjectURL(image);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; // transparent PNG sketches → white paper, not black
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    if (typeof image !== "string") URL.revokeObjectURL(src);
  }
}
