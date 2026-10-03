import { usePlaybound } from "../../core/store";
import type { Proposal } from "../../core/types";

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const acceptProposal = usePlaybound((s) => s.acceptProposal);
  const rejectProposal = usePlaybound((s) => s.rejectProposal);
  const locked = usePlaybound((s) => s.level.locked);
  const preview = proposal.previewProve;
  const layoutChange = !!(proposal.add?.length || proposal.update?.length || proposal.remove?.length || proposal.replaceAll);
  const blocked = layoutChange && locked;

  const tone =
    preview?.status === "pass" ? "pass" : preview?.status === "fail" ? "fail" : "idle";

  const pct =
    preview?.coveredFraction != null ? `${Math.round(preview.coveredFraction * 100)}% protected` : null;

  return (
    <article className={`proposal-card proposal-card--${tone}`}>
      <div className="proposal-source">{proposal.source}</div>
      <p className="proposal-why">{proposal.why}</p>
      {proposal.replaceAll && <p className="proposal-flag">Replaces the current layout</p>}
      {proposal.styleNotes && !layoutChange && (
        <p className="proposal-notes mono">{proposal.styleNotes}</p>
      )}
      {preview && (
        <div className={`proposal-prove proposal-prove--${preview.status}`}>
          {preview.message ?? preview.status}
          {pct ? ` · ${pct}` : ""}
        </div>
      )}
      {blocked && <p className="muted">Unlock to accept layout changes.</p>}
      <div className="proposal-actions">
        <button type="button" className="proposal-accept" disabled={blocked} onClick={() => acceptProposal(proposal.id)}>
          Accept
        </button>
        <button type="button" className="proposal-reject" onClick={() => rejectProposal(proposal.id)}>
          Reject
        </button>
      </div>
    </article>
  );
}

/** Floating cards for pending AI proposals (Accept / Reject only — never auto-apply). */
export function ProposalCards() {
  const proposals = usePlaybound((s) => s.proposals);
  if (proposals.length === 0) return null;
  return (
    <div className="proposal-cards">
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} />
      ))}
    </div>
  );
}
