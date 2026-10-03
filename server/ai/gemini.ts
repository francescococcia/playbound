// Minimal Gemini REST client: text + optional image in, JSON out. Key stays server-side
// (header, never in the URL). Falls back to a second model on rate limits / overload.

export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-flash-latest"];
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiJson<T> {
  data: T;
  model: string;
}

export async function geminiJson<T>(
  apiKey: string,
  prompt: string,
  opts: { image?: string; schema?: Record<string, unknown>; temperature?: number; fast?: boolean; timeoutMs?: number } = {},
): Promise<GeminiJson<T>> {
  const parts: unknown[] = [{ text: prompt }];
  if (opts.image) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(opts.image);
    if (!m) throw new Error("Image must be a base64 data URL");
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  const bodyFor = (fast: boolean) =>
    JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        ...(opts.schema && { responseSchema: opts.schema }),
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: 8192,
        // `fast`: little thinking. 5x faster on simple spatial picks; sketches keep full thinking.
        ...(fast && { thinkingConfig: { thinkingLevel: "low" } }),
      },
    });

  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    let fast = !!opts.fast;
    let r: Response;
    try {
      r = await post(model, bodyFor(fast));
      if (r.status === 400 && fast) {
        fast = false; // this model doesn't accept thinkingLevel: retry plainly
        r = await post(model, bodyFor(false));
      }
    } catch (e) {
      lastErr = `${model}: ${e instanceof Error && e.name === "TimeoutError" ? "timed out" : String(e)}`;
      continue;
    }
    const j = (await r.json().catch(() => ({}))) as {
      error?: { status?: string; message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    if (j.error || !r.ok) {
      lastErr = `${model}: ${j.error?.status ?? r.status} ${j.error?.message ?? ""}`.trim();
      // Rate limit / overload / unknown model → try the next one; anything else is final.
      if ([404, 429, 500, 503].includes(r.status)) continue;
      throw new Error(lastErr);
    }
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return { data: JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as T, model };
    } catch {
      lastErr = `${model}: response was not JSON`;
    }
  }
  throw new Error(`AI unavailable (${lastErr})`);

  function post(model: string, body: string) {
    return fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
    });
  }
}
