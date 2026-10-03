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
