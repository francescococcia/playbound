// Wire types for the local /api/rodin route (server/rodinDevPlugin.ts).

export interface GenerateRequest {
  key: string; // assetKey(prompt, size, seed)
  prompt: string;
  volumeId: string;
  /** Optional: adopt an existing Rodin generation instead of starting a new one. */
  generationId?: string;
}

export type JobStatus = "queued" | "generating" | "processing" | "ready" | "error";

export interface JobResponse {
  jobId: string;
  status: JobStatus;
  /** e.g. "texture 3/5" while Rodin works, "optimizing" while we shrink the GLB. */
  stage?: string;
  /** Set when ready: URL served by the app, e.g. /assets/gen/<key>.glb */
  url?: string;
  error?: string;
}

export interface ManifestEntry {
  key: string;
  volumeId: string;
  prompt: string;
  generationId: string;
  url: string;
  createdAt: string;
}
