// Dev server route /api/ai/* -> the same handler the Vercel function uses.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { handleAi } from "./ai/handler.js";

export function aiDevPlugin(apiKey: string | undefined): Plugin {
  return {
    name: "playbound-ai-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/ai", (req: IncomingMessage, res: ServerResponse) => {
        const action = new URL(req.url ?? "/", "http://local").pathname.replace(/^\/+/, "");
        readBody(req)
          .then((raw) => handleAi(action, req.method ?? "GET", raw ? JSON.parse(raw) : {}, apiKey))
          .then((r) => send(res, r.status, r.body))
          .catch((e: unknown) => send(res, 500, { error: String(e) }));
      });
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let s = "";
    req.on("data", (d) => (s += d));
    req.on("end", () => ok(s));
    req.on("error", fail);
  });
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
