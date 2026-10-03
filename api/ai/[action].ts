// Vercel function: /api/ai/<action> on the public site. GEMINI_API_KEY lives in the
// Vercel project's environment variables (server-only).
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAi } from "../../server/ai/handler.js";

type Req = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> };

export default async function handler(req: Req, res: ServerResponse) {
  const q = req.query?.action;
  const action = (Array.isArray(q) ? q[0] : q) ?? new URL(req.url ?? "/", "http://x").pathname.split("/").pop() ?? "";
  let body = req.body;
  if (body === undefined && req.method === "POST") {
    let s = "";
    for await (const chunk of req) s += chunk;
    body = s ? JSON.parse(s) : {};
  }
  if (typeof body === "string") body = JSON.parse(body);
  const ip = String(req.headers["x-forwarded-for"] ?? "anon").split(",")[0].trim();
  const r = await handleAi(action, req.method ?? "GET", body ?? {}, process.env.GEMINI_API_KEY, ip);
  res.statusCode = r.status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(r.body));
}
