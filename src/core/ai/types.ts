// Wire types for /api/ai/* (server/ai/handler.ts). Every AI action returns a Proposal
// that the designer must Accept; nothing is applied server-side.
import type { Level, Proposal } from "../types";

/** Images are sent as data URLs (the client downscales to ≤1024 px JPEG first). */
export interface SketchRequest {
  image: string;
}
export interface StyleRequest {
  image: string;
}
export interface CommandRequest {
  text: string;
  level: Level;
}
export interface FixRequest {
  level: Level;
}

export interface AiResponse {
  proposal?: Proposal;
  /** Human-readable reason when there's nothing to propose (e.g. "already passes"). */
  note?: string;
  error?: string;
  /** Which model answered (shown small in the UI for honesty). */
  model?: string;
}

export interface AiHealth {
  ai: boolean;
  model?: string;
}

// ---- Round 3: the Co-designer agent ----

export interface AgentTurn {
  role: "user" | "agent";
  text: string;
}

export interface AgentRequest {
  message: string;
  /** Optional image (sketch → layout, or picture → style); the agent decides which. */
  image?: string;
  level: Level;
  /** Last few turns, oldest first (for follow-ups like "make it bigger"). */
  history?: AgentTurn[];
}

export interface AgentResponse {
  /** Short plain-language answer (1–3 sentences). */
  reply: string;
  /** 0–3 proposals, each validated and previewed with Prove. */
  proposals: Proposal[];
  /** 2–3 short follow-up suggestions for the chips. */
  chips: string[];
  /** What the agent decided to do. */
  intent: "fix" | "explain" | "edit" | "sketch" | "style" | "chat";
  model?: string;
  error?: string;
}
