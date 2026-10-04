// End-of-run card for the playtest replay (Round 4 · A).
import { Play, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { usePlaybound } from "../../core/store";
import { useReplay } from "../scene/BotReplay";

export function ReplayCard() {
  const result = useReplay((s) => s.result);
  const playing = useReplay((s) => s.playing);
  const replay = useReplay((s) => s.replay);
  const viewMode = usePlaybound((s) => s.viewMode);
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState<typeof result>(null);
  if (viewMode !== "orbit") return null;

  const show = result && result !== hidden;
  const pct = result ? Math.round((result.spottedSeconds / Math.max(result.totalSeconds, 0.01)) * 100) : 0;

  return (
    <div className="replay-slot">
      {playing && (
        <div className="replay-live" role="status">
          <span className="replay-live-dot" /> Playtest bot running…
        </div>
      )}
      <AnimatePresence>
        {show && result && (
          <motion.div
            key={result.totalSeconds + result.spottedSeconds}
            className={`replay-card replay-card--${result.pass ? "pass" : "fail"}`}
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="status"
          >
            <div className="replay-card-head">
              <span className="replay-card-title">Playtest</span>
              <button type="button" className="icon-btn" title="Close" onClick={() => setHidden(result)}>
                <X size={13} strokeWidth={1.75} />
              </button>
            </div>
            <p className="replay-card-line">
              Spotted for <strong className="mono">{result.spottedSeconds.toFixed(1)} s</strong> of{" "}
              <span className="mono">{result.totalSeconds.toFixed(1)} s</span> <span className="replay-pct">({pct}%)</span>
            </p>
            <p className="replay-card-sub">
              {result.pass
                ? `Longest time in the open: ${result.longestExposedSeconds.toFixed(1)} s. Players can move cover to cover.`
                : `${result.longestExposedSeconds.toFixed(1)} s in the open without a break: a defender at the goal gets an easy shot.`}
            </p>
            <button type="button" className="replay-again" onClick={replay}>
              <Play size={13} strokeWidth={2} /> Replay
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
