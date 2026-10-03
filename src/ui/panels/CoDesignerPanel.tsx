import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { isAiAvailable } from "../../core/ai/client";
import { useUiPrefs } from "../uiPrefs";
import { AiPanel } from "./AiPanel";
import { ProposalCards } from "./ProposalCards";

/**
 * Co-designer home (DESIGN_BRIEF §4).
 * U17: placeholder shell + existing AI buttons / proposal cards.
 * U19: full conversation agent.
 */
export function CoDesignerPanel() {
  const setToast = useUiPrefs((s) => s.setToast);
  const open = useUiPrefs((s) => s.coDesignerOpen);
  const toggle = useUiPrefs((s) => s.toggleCoDesigner);
  const [aiOk, setAiOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isAiAvailable().then((ok) => {
      if (!cancelled) setAiOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const status = aiOk === null ? "checking" : aiOk ? "online" : "offline";
  const statusLabel =
    status === "checking" ? "Checking…" : status === "online" ? "Online" : "AI not configured";

  return (
    <aside className={`co-designer${open ? "" : " co-designer--collapsed"}`}>
      <header className="co-designer-head">
        <div className="co-designer-title">
          <Sparkles size={16} strokeWidth={1.75} className="co-designer-icon" aria-hidden />
          <span>Co-designer</span>
          <span className={`status-dot status-dot--${status}`} title={statusLabel} />
          <span className="status-label">{statusLabel}</span>
        </div>
        <button type="button" className="co-designer-toggle" onClick={toggle} title={open ? "Collapse" : "Expand"}>
          {open ? "Hide" : "Show"}
        </button>
      </header>

      {open && (
        <div className="co-designer-body">
          <p className="co-designer-note">
            Ask for layout changes, a sketch import, or a fix. Suggestions stay violet until you Accept.
          </p>
          <AiPanel onToast={setToast} />
          <div className="co-designer-proposals">
            <ProposalCards embedded />
          </div>
        </div>
      )}
    </aside>
  );
}
