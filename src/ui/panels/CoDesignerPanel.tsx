// The Co-designer (DESIGN_BRIEF §4): the AI's one home. A conversation where every answer
// can be acted on. Proposals are violet ghosts until the designer Accepts them.
import { ArrowUp, Check, ChevronDown, Eye, ImagePlus, Lock, Paintbrush, Play, RotateCcw, Share2, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { aiAgent, aiStyle, isAiAvailable } from "../../core/ai/client";
import { dressLevel } from "../../core/dress/dress";
import { shareUrl } from "../../core/share";
import { STEPS, canDress, currentStep, usePlaybound, type AgentMessage, type Step } from "../../core/store";
import type { Level, Proposal } from "../../core/types";
import { useUiPrefs } from "../uiPrefs";
import { useAutopilot } from "../../core/ai/autopilot";
import { AutopilotTracker } from "./AutopilotTracker";

export function CoDesignerPanel() {
  const open = useUiPrefs((s) => s.coDesignerOpen);
  const toggle = useUiPrefs((s) => s.toggleCoDesigner);
  const thread = usePlaybound((s) => s.agentThread);
  const clearThread = usePlaybound((s) => s.clearAgentThread);
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File | null>(null);
  const autopilot = useAutopilot((s) => s.active);

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
          {/* Autopilot (Claude Code): the start form while the thread is empty; its tracker replaces the guide while running. */}
          {(autopilot || thread.length === 0) && <AutopilotTracker aiOk={!!aiOk} />}
          {!autopilot && <NextStepGuide aiOk={!!aiOk} />}
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

// ---------- next-step guide ----------

/**
 * Always answers "what do I do now, and what will happen?" for the step the level is in.
 * One primary action (the same as the action bar), plus what to expect.
 */
function NextStepGuide({ aiOk }: { aiOk: boolean }) {
  const level = usePlaybound((s) => s.level);
  const runProve = usePlaybound((s) => s.runProve);
  const lock = usePlaybound((s) => s.lock);
  const setViewMode = usePlaybound((s) => s.setViewMode);
  const setToast = useUiPrefs((s) => s.setToast);
  const hasConversation = usePlaybound((s) => s.agentThread.some((m) => m.role === "user"));
  const [open, setOpen] = useState(!hasConversation);
  const [busy, setBusy] = useState(false);
  const step: Step = currentStep(level);
  const n = STEPS.findIndex((x) => x.id === step) + 1;
  const pv = level.prove;
  const failing = pv?.status === "fail";
  const g = guideFor(step, failing, pv?.exposedMeters);

  const act = async () => {
    if (step === "blockout") return aiOk && aiAgent("Build a medieval market square level");
    if (step === "prove") return failing && aiOk ? aiAgent("Fix the death corridor") : runProve();
    if (step === "lock") return lock();
    if (step === "dress") {
      const gate = canDress(level);
      if (!gate.ok) return setToast(gate.why ?? "Not ready to dress yet", "error");
      setBusy(true);
      try {
        await dressLevel();
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e), "error");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === "play") return setViewMode("fps");
  };
  const secondary = async () => {
    if (step === "prove" && failing) return aiAgent("Why does it fail?");
    if (step === "play") {
      try {
        await navigator.clipboard.writeText(await shareUrl(level));
        setToast("Share link copied");
      } catch {
        setToast("Could not copy the link", "error");
      }
    }
  };

  return (
    <section className={`co-guide co-guide--${step}${failing && step === "prove" ? " co-guide--fail" : ""}`}>
      <button type="button" className="co-guide-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="co-guide-step">
          Step {n} of 5 · {STEPS[n - 1].label}
        </span>
        <ChevronDown size={14} strokeWidth={1.75} className={open ? "co-guide-chev co-guide-chev--open" : "co-guide-chev"} />
      </button>
      {open && (
        <div className="co-guide-body">
          <p className="co-guide-do">{g.doThis}</p>
          <p className="co-guide-expect">{g.expect}</p>
          {step === "dress" ? (
            <DressStyleSetup aiOk={aiOk} />
          ) : (
            <div className="co-guide-actions">
              <button type="button" className="co-guide-primary" disabled={busy || (g.needsAi && !aiOk)} onClick={act}>
                {g.icon}
                {busy ? "Working…" : g.action}
              </button>
              {g.second && (
                <button type="button" className="co-guide-secondary" disabled={g.needsAi && !aiOk} onClick={secondary}>
                  {g.second}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DressStyleSetup({ aiOk }: { aiOk: boolean }) {
  const level = usePlaybound((s) => s.level);
  const setStyleRef = usePlaybound((s) => s.setStyleRef);
  const setToast = useUiPrefs((s) => s.setToast);
  const [notes, setNotes] = useState(level.styleNotes ?? "");
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setNotes(level.styleNotes ?? ""), [level.id, level.styleNotes]);

  const saveNotes = (value = notes) => {
    const clean = value.trim();
    setStyleRef(level.styleRefUrl, clean || undefined);
  };

  const onImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setStyleRef(reader.result, notes.trim() || undefined);
    };
    reader.readAsDataURL(file);

    if (!aiOk) {
      setToast("Reference saved. AI style reading is unavailable, so keep or edit the written direction.");
      return;
    }
    setReading(true);
    setToast("Reading the reference image…");
    void aiStyle(file)
      .then((out) => setToast(out.proposal ? "Style notes are ready below — Accept them to use them." : out.note ?? "Reference saved."))
      .catch((error) => setToast(error instanceof Error ? error.message : String(error), "error"))
      .finally(() => setReading(false));
  };

  return (
    <div className="dress-setup">
      <label className="dress-field">
        <span className="dress-field-head">
          <span>1 · Art direction</span>
          <span className="dress-required">Required</span>
        </span>
        <textarea
          value={notes}
          rows={3}
          placeholder="e.g. stylised medieval European market town, warm hand-painted textures, readable game art"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => saveNotes()}
        />
        <span className="dress-help">This text is added to every 3D model prompt. Describe era, materials, palette and rendering style.</span>
      </label>

      <div className="dress-field">
        <div className="dress-field-head">
          <span>2 · Visual reference</span>
          <span className="dress-optional">Optional</span>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            onImage(file);
          }}
        />
        {level.styleRefUrl ? (
          <div className="dress-reference">
            <img src={level.styleRefUrl} alt="Current style reference" />
            <div>
              <strong>Reference added</strong>
              <span>Used to extract visual cues into the art direction.</span>
            </div>
            <button type="button" className="icon-btn" title="Remove reference" onClick={() => setStyleRef(undefined, notes.trim() || undefined)}>
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <button type="button" className="dress-upload" disabled={reading} onClick={() => input.current?.click()}>
            <ImagePlus size={17} strokeWidth={1.6} />
            <span>
              <strong>{reading ? "Reading image…" : "Add reference image"}</strong>
              <small>Choose one clear street or environment image</small>
            </span>
          </button>
        )}
        {level.styleRefUrl && (
          <button type="button" className="dress-replace" disabled={reading} onClick={() => input.current?.click()}>
            {reading ? "Reading image…" : "Replace image"}
          </button>
        )}
        <p className="dress-image-tip">Best: concept art or a game screenshot showing buildings, stalls, stone, wood and lighting together. Avoid collages, UI and character close-ups.</p>
      </div>
    </div>
  );
}

function guideFor(step: Step, failing: boolean, exposed?: number) {
  const icon = (I: typeof Play) => <I size={14} strokeWidth={1.75} />;
  switch (step) {
    case "blockout":
      return {
        doThis: "Lay out the level with grey boxes: pick a preset on the left, Add boxes, or drop a top-down sketch below.",
        expect: "A sketch comes back as violet ghost boxes. Nothing changes until you Accept.",
        action: "Build one for me",
        second: null,
        icon: icon(Sparkles),
        needsAi: true,
      };
    case "prove":
      return failing
        ? {
            doThis: `It fails: ${exposed ?? "part"} m of the route is in the open (red). Add cover, then Prove again.`,
            expect: "Suggest fix proposes cover that already passes Prove. Or drag a blue cover box next to the red line yourself.",
            action: "Suggest fix",
            second: "Why does it fail?",
            icon: icon(Sparkles),
            needsAi: true,
          }
        : {
            doThis: "Check the layout is playable: a bot walks from the start (green) to the goal (gold).",
            expect: "You get the route, a heatmap of what defenders at the goal can see, Pass or Fail, and a bot replays the run.",
            action: "Run Prove",
            second: null,
            icon: icon(Play),
            needsAi: false,
          };
    case "lock":
      return {
        doThis: "It passes. Lock the layout so the gameplay can no longer change.",
        expect: "After locking, boxes stay put. The AI can only change how things look.",
        action: "Lock layout",
        second: null,
        icon: icon(Lock),
        needsAi: false,
      };
    case "dress":
      return {
        doThis: "Choose the shared visual language for every object, then use Dress level below the scene.",
        expect: "Your text drives generation. A reference image is optional: the AI reads it and proposes more specific style notes.",
        action: "Dress level",
        second: null,
        icon: icon(Paintbrush),
        needsAi: false,
      };
    default:
      return {
        doThis: "Walk your level: click Walk it, then click the view. WASD to move, mouse to look, Esc to exit.",
        expect: "You collide with the original boxes, so the art can never block a route. Share copies a link anyone can open.",
        action: "Walk it",
        second: (
          <>
            <Share2 size={13} strokeWidth={1.75} /> Copy share link
          </>
        ),
        icon: icon(Play),
        needsAi: false,
      };
  }
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
              <ProposalRow
                proposalId={id}
                index={i}
                optionLabel={alternatives ? `Option ${"ABC"[i]}` : undefined}
                siblings={alternatives ? ids.filter((x) => x !== id) : undefined}
              />
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
                if (live.some((p) => p.redress)) startRedress();
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

/** After a look change is accepted: make the new models now if Dress is possible, else say when. */
function startRedress() {
  const toast = useUiPrefs.getState().setToast;
  if (!canDress(usePlaybound.getState().level).ok) {
    toast("New look saved: it is used when you Dress the level.");
    return;
  }
  toast("Making the new models…");
  dressLevel()
    .then(() => toast("New look applied."))
    .catch((e) => toast(e instanceof Error ? e.message : String(e)));
}

function ProposalRow({
  proposal: given,
  proposalId,
  index,
  optionLabel,
  siblings,
}: {
  proposal?: Proposal;
  proposalId?: string;
  index: number;
  optionLabel?: string;
  /** Other options of the same answer: accepting this one dismisses them (they're alternatives). */
  siblings?: string[];
}) {
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
        <span>{outcome === "accepted" ? "Accepted" : siblings ? "Not chosen" : "Dismissed"}</span>
        {outcome === "accepted" && <Check size={13} strokeWidth={2} />}
      </div>
    );
  }

  const [said, changes] = splitWhy(proposal.why);
  const layout = changesLayout(proposal);
  const blocked = layout && locked;
  const pv = proposal.previewProve;
  const pct = pv?.coveredFraction != null ? Math.round(pv.coveredFraction * 100) : null;
  const tag =
    optionLabel ??
    (proposal.unlock ? "Unlock" : proposal.redress && !proposal.styleNotes ? "New look" : { fix: "Fix", sketch: "From sketch", style: "Style", text: "Edit" }[proposal.source]);
  const redressN = proposal.redress?.ids.length ?? 0;
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
      {proposal.styleNotes && <p className="co-prop-style">{layout ? `Look: ${proposal.styleNotes}` : proposal.styleNotes}</p>}
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
            for (const other of siblings ?? []) {
              if (usePlaybound.getState().proposals.some((p) => p.id === other)) {
                setOutcome(other, "dismissed");
                reject(other);
              }
            }
            if (layout) runProve(); // show the result straight away
            if (proposal.redress) startRedress();
          }}
        >
          <Check size={14} strokeWidth={2} />{" "}
          {proposal.unlock ? "Unlock layout" : redressN ? `Accept · re-dress ${redressN} model${redressN > 1 ? "s" : ""}` : "Accept"}
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
      {image && /osm|openstreetmap/i.test(image.name) && (
        <p className="map-credit map-credit--inline">© OpenStreetMap contributors</p>
      )}
      {image && (
        <p className="co-image-hint">
          <strong>Top-down drawing or map</strong> → a full greybox proposal (~15 s, replaces the level when you Accept).{" "}
          <strong>Picture of a place or artwork</strong> → art style for Dress (~7 s). Say which, or just send.
        </p>
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
