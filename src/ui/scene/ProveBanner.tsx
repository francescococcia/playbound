import { usePlaybound } from "../../core/store";

/** Overlay banner for Prove result + honest-limit disclaimer. */
export function ProveBanner() {
  const prove = usePlaybound((s) => s.level.prove);
  if (!prove || prove.status === "idle") return null;

  const tone = prove.status === "pass" ? "pass" : "fail";

  return (
    <div className={`prove-banner prove-banner--${tone}`} role="status">
      <div className="prove-banner-msg">{prove.message ?? (prove.status === "pass" ? "Pass" : "Fail")}</div>
      <div className="prove-banner-note">Prove = path + cover heuristic, not a combat sim.</div>
    </div>
  );
}
