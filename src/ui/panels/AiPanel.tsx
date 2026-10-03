import { useEffect, useRef, useState } from "react";
import { aiCommand, aiSketch, isAiAvailable, type AiOutcome } from "../../core/ai/client";
import { usePlaybound } from "../../core/store";

async function runAi(
  label: string,
  fn: () => Promise<AiOutcome>,
  onToast: (msg: string) => void,
  setBusy: (v: string | null) => void,
) {
  setBusy(label);
  try {
    const out = await fn();
    if (out.note) onToast(out.note);
    else if (out.proposal) onToast(`AI proposal ready — Accept or Reject.`);
    else onToast("AI returned nothing.");
  } catch (e) {
    onToast(e instanceof Error ? e.message : String(e));
  } finally {
    setBusy(null);
  }
}

export function AiPanel({ onToast }: { onToast: (msg: string) => void }) {
  const locked = usePlaybound((s) => s.level.locked);
  const sketchRef = useRef<HTMLInputElement>(null);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [command, setCommand] = useState("");

  useEffect(() => {
    let cancelled = false;
    isAiAvailable().then((ok) => {
      if (!cancelled) setAiOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [busy]);

  const disabled = aiOk === false || busy != null;
  const tip = aiOk === false ? "AI not configured" : busy ? `${busy}…` : undefined;

  return (
    <div className="side-section ai-panel">
      <h2>AI co-designer</h2>
      {aiOk === false && <p className="muted">AI not configured (set Gemini key on the server).</p>}
      {busy && (
        <p className="ai-busy" role="status">
          <span className="btn-spin" aria-hidden />
          <span>
            <strong>{busy}</strong>
            <span className="ai-busy-sub"> ~5–10 s · {elapsed}s</span>
          </span>
        </p>
      )}

      <input
        ref={sketchRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || locked) return;
          void runAi("Sketch → level", () => aiSketch(file), onToast, setBusy);
        }}
      />
      <button
        type="button"
        className={`ai-btn${busy === "Sketch → level" ? " ai-btn--busy" : ""}`}
        disabled={disabled || locked}
        title={locked ? "Unlock to replace the layout" : tip ?? "Upload a sketch / map → greybox proposal"}
        onClick={() => sketchRef.current?.click()}
      >
        {busy === "Sketch → level" && <span className="btn-spin" aria-hidden />}
        {busy === "Sketch → level" ? "Reading sketch…" : "Sketch → level"}
      </button>

      <form
        className="ai-command"
        onSubmit={(e) => {
          e.preventDefault();
          const text = command.trim();
          if (!text || locked || disabled) return;
          void runAi("Command", () => aiCommand(text), onToast, setBusy).then(() => setCommand(""));
        }}
      >
        <input
          type="text"
          value={command}
          disabled={disabled || locked}
          placeholder='e.g. "add a fountain near the well"'
          title={tip}
          onChange={(e) => setCommand(e.target.value)}
        />
        <button type="submit" disabled={disabled || locked || !command.trim()} title={tip}>
          {busy === "Command" ? <span className="btn-spin" aria-hidden /> : "Go"}
        </button>
      </form>
    </div>
  );
}
