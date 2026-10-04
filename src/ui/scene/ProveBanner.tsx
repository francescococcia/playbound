import { useEffect, useState } from "react";
import { aiSuggestFix, isAiAvailable } from "../../core/ai/client";
import { usePlaybound } from "../../core/store";
import { useUiPrefs } from "../uiPrefs";

/** Overlay banner for Prove result. Hidden in FPS (fades out after a short beat if just switched). */
export function ProveBanner() {
  const prove = usePlaybound((s) => s.level.prove);
  const viewMode = usePlaybound((s) => s.viewMode);
  const locked = usePlaybound((s) => s.level.locked);
  const setToast = useUiPrefs((s) => s.setToast);
  const [fpsHidden, setFpsHidden] = useState(false);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (viewMode !== "fps") {
      setFpsHidden(false);
      return;
    }
    const t = window.setTimeout(() => setFpsHidden(true), 3000);
    return () => window.clearTimeout(t);
  }, [viewMode, prove?.checkedAt, prove?.status]);

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
    if (!fixBusy) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [fixBusy]);

  if (!prove || prove.status === "idle") return null;
  if (viewMode === "fps" && fpsHidden) return null;

  const tone = prove.status === "pass" ? "pass" : "fail";
  const fading = viewMode === "fps";
  const showFix = prove.status === "fail" && !locked && viewMode !== "fps";

  const onFix = async () => {
    if (fixBusy || aiOk === false) return;
    setFixBusy(true);
    try {
      const out = await aiSuggestFix();
      if (out.note) setToast(out.note);
      else if (out.proposal) setToast("Fix proposal ready — Accept or Reject.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setFixBusy(false);
    }
  };

  return (
    <div
      className={`prove-banner prove-banner--${tone}${fading ? " prove-banner--fps-fade" : ""}`}
      role="status"
    >
      <div className="prove-banner-msg">{prove.message ?? (prove.status === "pass" ? "Pass" : "Fail")}</div>
      <div className="prove-banner-note">
        Prove = path + cover + line of sight
        {prove.exposedMeters != null ? ` · ${prove.exposedMeters.toFixed(0)} m exposed` : ""}
      </div>
      {showFix && (
        <button
          type="button"
          className="suggest-fix-btn"
          disabled={fixBusy || aiOk === false}
          title={aiOk === false ? "AI not configured" : "Ask AI for cover that makes Prove pass"}
          onClick={onFix}
        >
          {fixBusy ? (
            <>
              <span className="btn-spin" aria-hidden /> Suggesting… ~5–10 s · {elapsed}s
            </>
          ) : (
            "Suggest fix"
          )}
        </button>
      )}
    </div>
  );
}
