// The Co-designer (DESIGN_BRIEF §4): the AI's one home. A conversation where every answer
// can be acted on. Proposals are violet ghosts until the designer Accepts them.
import { ArrowUp, Check, Eye, ImagePlus, RotateCcw, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { aiAgent, isAiAvailable } from "../../core/ai/client";
import { usePlaybound, type AgentMessage } from "../../core/store";
import type { Level, Proposal } from "../../core/types";
import { useUiPrefs } from "../uiPrefs";

export function CoDesignerPanel() {
  const open = useUiPrefs((s) => s.coDesignerOpen);
  const toggle = useUiPrefs((s) => s.toggleCoDesigner);
  const thread = usePlaybound((s) => s.agentThread);
  const clearThread = usePlaybound((s) => s.clearAgentThread);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    isAiAvailable().then((ok) => !cancelled && setAiOk(ok));
    return () => {
      cancelled = true;
    };
  }, []);

  const busy = thread.some((m) => m.pending);
  const status = aiOk === null ? "checking" : !aiOk ? "offline" : busy ? "thinking" : "online";
  const statusLabel = { checking: "Connecting…", offline: "AI not configured", thinking: "Thinking…", online: "Ready" }[status];

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (f) setDropped(f);
  };

  return (
    <aside
      className={`co-designer${open ? "" : " co-designer--collapsed"}${dragging ? " co-designer--drop" : ""}`}
      onDragOver={(e) => {
        if (!open || !aiOk) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
      aria-label="Co-designer"
    >
      <header className="co-designer-head">
        <div className="co-designer-title">
          <Sparkles size={16} strokeWidth={1.75} className="co-designer-icon" aria-hidden />
          <span>Co-designer</span>
          <span className={`status-dot status-dot--${status}`} title={statusLabel} />
          <span className="status-label">{statusLabel}</span>
        </div>
        <div className="co-designer-head-actions">
          {open && thread.length > 0 && (
            <button type="button" className="icon-btn" onClick={clearThread} title="New conversation">
              <RotateCcw size={14} strokeWidth={1.75} />
            </button>
          )}
          <button type="button" className="co-designer-toggle" onClick={toggle} title={open ? "Collapse" : "Expand"}>
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </header>

      {open && (
        <>
          <Thread disabled={!aiOk} />
          <Composer disabled={!aiOk || busy} dropped={dropped} onConsumeDrop={() => setDropped(null)} />
          {dragging && (
            <div className="co-drop-overlay" aria-hidden>
              <ImagePlus size={22} strokeWidth={1.5} />
              <span>Drop a sketch (→ layout) or a picture (→ style)</span>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

// ---------- conversation ----------

function Thread({ disabled }: { disabled: boolean }) {
  const thread = usePlaybound((s) => s.agentThread);
  const proposals = usePlaybound((s) => s.proposals);
  const level = usePlaybound((s) => s.level);
  const reduce = useReducedMotion();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [thread, reduce]);

  // Proposals made outside the conversation (e.g. Sketch → level in the action bar).
  const inThread = new Set(thread.flatMap((m) => m.proposalIds ?? []));
  const orphans = proposals.filter((p) => !inThread.has(p.id));
  const lastAgent = [...thread].reverse().find((m) => m.role === "agent" && !m.pending);

  return (
    <div className="co-thread" role="log" aria-live="polite">
      {thread.length === 0 && <EmptyState level={level} disabled={disabled} />}
      <AnimatePresence initial={false}>
        {thread.map((m) => (
          <motion.div
            key={m.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {m.role === "user" ? <UserBubble m={m} /> : <AgentBubble m={m} showChips={m === lastAgent} disabled={disabled} />}
          </motion.div>
        ))}
      </AnimatePresence>
      {orphans.length > 0 && (
        <section className="co-orphans">
          <h4 className="co-section-label">Suggestions</h4>
          {orphans.map((p, i) => (
            <ProposalRow key={p.id} proposal={p} index={i} />
          ))}
        </section>
      )}
      <div ref={end} />
    </div>
  );
}

function EmptyState({ level, disabled }: { level: Level; disabled: boolean }) {
  const chips = contextChips(level);
  return (
    <div className="co-empty">
      <p className="co-empty-lead">I help you design, prove and dress this level.</p>
      <ul className="co-empty-list">
        <li>Turn a sketch or map into a greybox</li>
        <li>Explain and fix death corridors</li>
        <li>Suggest layout changes, checked by Prove</li>
        <li>Read the art style from a picture</li>
      </ul>
      <p className="co-empty-note">Nothing changes until you click Accept.</p>
      <Chips chips={chips} disabled={disabled} />
    </div>
  );
}

function UserBubble({ m }: { m: AgentMessage }) {
  return (
    <div className="co-msg co-msg--user">
      {m.imageThumb && <img className="co-thumb" src={m.imageThumb} alt="Attached image" />}
      {m.text && <p>{m.text}</p>}
    </div>
  );
}

function AgentBubble({ m, showChips, disabled }: { m: AgentMessage; showChips: boolean; disabled: boolean }) {
  const thread = usePlaybound((s) => s.agentThread);
  const proposals = usePlaybound((s) => s.proposals);
  const acceptAll = usePlaybound((s) => s.acceptAll);
  const runProve = usePlaybound((s) => s.runProve);
  const setOutcome = useUiPrefs((s) => s.setProposalOutcome);
  const reduce = useReducedMotion();

  if (m.pending) {
    const prev = thread[thread.indexOf(m) - 1];
    const hint = prev?.imageThumb ? "Reading your image… ~15 s" : "Thinking…";
    return (
      <div className="co-msg co-msg--agent co-msg--pending">
        <span className="co-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="co-pending-text">{hint}</span>
      </div>
    );
  }

  if (m.error) {
    const prev = [...thread.slice(0, thread.indexOf(m))].reverse().find((x) => x.role === "user");
    return (
      <div className="co-msg co-msg--agent co-msg--error">
        <p>{m.error}</p>
        {prev && !disabled && (
          <button type="button" className="co-retry" onClick={() => aiAgent(prev.text)}>
            <RotateCcw size={13} strokeWidth={1.75} /> Try again
          </button>
        )}
      </div>
    );
  }

  const ids = m.proposalIds ?? [];
  const live = ids.map((id) => proposals.find((p) => p.id === id)).filter((p): p is Proposal => !!p);
  const alternatives = m.intent === "edit" && ids.length > 1;

  return (
    <div className="co-msg co-msg--agent">
      {m.text && <p>{m.text}</p>}
      {ids.length > 0 && (
        <div className="co-proposals">
          {alternatives && <p className="co-hint">Pick one option.</p>}
          {ids.map((id, i) => (
            <motion.div
              key={id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: reduce ? 0 : i * 0.05 }}
            >
              <ProposalRow proposalId={id} index={i} optionLabel={alternatives ? `Option ${"ABC"[i]}` : undefined} />
            </motion.div>
          ))}
          {!alternatives && live.length > 1 && (
            <button
              type="button"
              className="co-accept-all"
              onClick={() => {
                live.forEach((p) => setOutcome(p.id, "accepted"));
                acceptAll(live.map((p) => p.id));
                if (live.some(changesLayout)) runProve();
              }}
            >
              <Check size={14} strokeWidth={2} /> Accept all
            </button>
          )}
        </div>
      )}
      {showChips && m.chips && m.chips.length > 0 && <Chips chips={m.chips} disabled={disabled} />}
      {m.model && <span className="co-model">{m.model}</span>}
    </div>
  );
}

// ---------- proposals ----------

function ProposalRow({ proposal: given, proposalId, index, optionLabel }: { proposal?: Proposal; proposalId?: string; index: number; optionLabel?: string }) {
  const id = given?.id ?? proposalId!;
  const proposal = usePlaybound((s) => s.proposals.find((p) => p.id === id));
  const locked = usePlaybound((s) => s.level.locked);
  const highlighted = usePlaybound((s) => s.highlightedProposalId === id);
  const accept = usePlaybound((s) => s.acceptProposal);
  const reject = usePlaybound((s) => s.rejectProposal);
  const runProve = usePlaybound((s) => s.runProve);
  const setHighlight = usePlaybound((s) => s.setHighlightedProposal);
  const outcome = useUiPrefs((s) => s.proposalOutcome[id]);
  const setOutcome = useUiPrefs((s) => s.setProposalOutcome);

  if (!proposal) {
    return (
      <div className={`co-prop co-prop--done co-prop--${outcome ?? "dismissed"}`}>
        {optionLabel && <span className="co-prop-tag">{optionLabel}</span>}
        <span>{outcome === "accepted" ? "Accepted" : "Dismissed"}</span>
        {outcome === "accepted" && <Check size={13} strokeWidth={2} />}
      </div>
    );
  }

  const [said, changes] = splitWhy(proposal.why);
  const layout = changesLayout(proposal);
  const blocked = layout && locked;
  const pv = proposal.previewProve;
  const pct = pv?.coveredFraction != null ? Math.round(pv.coveredFraction * 100) : null;
  const tag = optionLabel ?? { fix: "Fix", sketch: "From sketch", style: "Style", text: "Edit" }[proposal.source];
  const hasGhosts = layout && !proposal.replaceAll;

  return (
    <article
      className={`co-prop${highlighted ? " co-prop--hl" : ""}`}
      onMouseEnter={() => hasGhosts && setHighlight(id)}
      onMouseLeave={() => hasGhosts && setHighlight(null)}
      style={{ ["--i" as string]: index }}
    >
      <header className="co-prop-head">
        <span className="co-prop-tag">{tag}</span>
        {pv && pv.status !== "idle" && (
          <span className={`co-pill co-pill--${pv.status}`}>
            {pv.status === "pass" ? "✓ Playable" : "✗ Fails"}
            {pct != null ? ` · ${pct}%` : ""}
          </span>
        )}
      </header>
      <p className="co-prop-why">{said}</p>
      {changes && <p className="co-prop-changes">{changes}</p>}
      {proposal.replaceAll && <p className="co-prop-warn">Replaces the whole layout</p>}
      {proposal.styleNotes && !layout && <p className="co-prop-style">{proposal.styleNotes}</p>}
      {blocked && <p className="co-prop-warn">Unlock the layout to accept this.</p>}
      <div className="co-prop-actions">
        {hasGhosts && (
          <button
            type="button"
            className={`icon-btn${highlighted ? " icon-btn--on" : ""}`}
            title="Highlight in the scene"
            onClick={() => setHighlight(highlighted ? null : id)}
          >
            <Eye size={14} strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          className="co-accept"
          disabled={blocked}
          onClick={() => {
            setOutcome(id, "accepted");
            setHighlight(null);
            accept(id);
            if (layout) runProve(); // show the result straight away
          }}
        >
          <Check size={14} strokeWidth={2} /> Accept
        </button>
        <button
          type="button"
          className="co-dismiss"
          onClick={() => {
            setOutcome(id, "dismissed");
            reject(id);
          }}
        >
          <X size={14} strokeWidth={1.75} /> Dismiss
        </button>
      </div>
    </article>
  );
}

// ---------- composer ----------

function Composer({ disabled, dropped, onConsumeDrop }: { disabled: boolean; dropped: File | null; onConsumeDrop: () => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  useEffect(() => {
    if (dropped) {
      setImage(dropped);
      onConsumeDrop();
    }
  }, [dropped, onConsumeDrop]);

  const send = () => {
    const msg = text.trim() || (image ? "Use this image" : "");
    if (!msg || disabled) return;
    aiAgent(msg, image ?? undefined);
    setText("");
    setImage(null);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={`co-composer${disabled ? " co-composer--disabled" : ""}`}>
      {preview && (
        <div className="co-attach">
          <img src={preview} alt="Image to send" />
          <span>{image?.name}</span>
          <button type="button" className="icon-btn" onClick={() => setImage(null)} title="Remove image">
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      )}
      <div className="co-input-row">
        <button type="button" className="icon-btn" title="Attach a sketch or style picture" disabled={disabled} onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} strokeWidth={1.75} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setImage(f);
            e.target.value = "";
          }}
        />
        <textarea
          rows={1}
          value={text}
          placeholder={image ? "What should I do with this image?" : "Ask the co-designer…"}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />
        <button type="button" className="co-send" title="Send (Enter)" disabled={disabled || (!text.trim() && !image)} onClick={send}>
          <ArrowUp size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function Chips({ chips, disabled }: { chips: string[]; disabled: boolean }) {
  return (
    <div className="co-chips">
      {chips.map((c) => (
        <button key={c} type="button" className="co-chip" disabled={disabled} onClick={() => aiAgent(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

// ---------- helpers ----------

function changesLayout(p: Proposal): boolean {
  return !!(p.add?.length || p.update?.length || p.remove?.length || p.replaceAll);
}

/** "Text… (Changes: adds X, moves Y.)" → ["Text…", "Adds X, moves Y."] */
function splitWhy(why: string): [string, string | null] {
  const m = /\s*\(Changes: (.+)\)\s*$/.exec(why);
  if (!m) return [why, null];
  const list = m[1].replace(/\.$/, "");
  return [why.slice(0, m.index), list.charAt(0).toUpperCase() + list.slice(1) + "."];
}

function contextChips(level: Level): string[] {
  if (level.volumes.length < 3) return ["Build a market square", "What can you do?", "Add a spawn and a goal"];
  if (level.prove?.status === "fail") return ["Fix the death corridor", "Why does it fail?", "Add a flanking route"];
  if (level.prove?.status === "pass" && !level.locked) return ["Make it more challenging", "Check sightlines from the goal", "Add landmarks"];
  if (level.locked) return ["Suggest a style", "Explain this level", "What should I dress first?"];
  return ["Is this level playable?", "Add cover near the well", "Add a flanking route"];
}
