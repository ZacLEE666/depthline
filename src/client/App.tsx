import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BellOff,
  Check,
  CircleAlert,
  Clock3,
  Coffee,
  Focus,
  LoaderCircle,
  MoonStar,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { api } from "./api";
import type { AttentionItem, AttentionState, DepthlineSnapshot } from "../shared/types";

const stateLabels: Record<AttentionState, string> = {
  needs_input: "Needs your judgment",
  needs_approval: "Approval requested",
  error: "Needs recovery",
  ready_review: "Ready for review",
  working: "Working quietly",
  parked: "Parked",
};

function relativeTime(date: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function focusMinutes(snapshot: DepthlineSnapshot): number {
  if (!snapshot.focus.until) return 0;
  return Math.max(0, Math.ceil((new Date(snapshot.focus.until).getTime() - Date.now()) / 60_000));
}

function Logo() {
  return (
    <div className="logo" aria-label="Depthline">
      <span className="logo-mark" aria-hidden="true">
        <span />
      </span>
      <span>Depthline</span>
    </div>
  );
}

function StateIcon({ state }: { state: AttentionState }) {
  if (state === "needs_input") return <CircleAlert size={16} />;
  if (state === "needs_approval") return <ShieldCheck size={16} />;
  if (state === "error") return <RefreshCw size={16} />;
  if (state === "ready_review") return <Check size={16} />;
  if (state === "working") return <LoaderCircle className="spin" size={16} />;
  return <Pause size={16} />;
}

interface ItemCardProps {
  item: AttentionItem;
  variant?: "decision" | "quiet" | "review";
  busy: boolean;
  onAction: (action: "focus" | "snooze" | "handled" | "open", item: AttentionItem) => void;
}

function ItemCard({ item, variant = "decision", busy, onAction }: ItemCardProps) {
  return (
    <article className={`item-card item-card--${variant}`}>
      <div className="item-topline">
        <span className={`state-pill state-pill--${item.state}`}>
          <StateIcon state={item.state} />
          {stateLabels[item.state]}
        </span>
        <span className="item-time">{relativeTime(item.updatedAt)}</span>
      </div>
      <div>
        <p className="item-project">{item.project}</p>
        <h3>{item.title}</h3>
      </div>
      {variant !== "quiet" && (
        <div className="capsule">
          <div>
            <span>Latest</span>
            <p>{item.capsule.latest}</p>
          </div>
          <div>
            <span>Next human move</span>
            <p>{item.capsule.nextAction}</p>
          </div>
        </div>
      )}
      <div className="item-actions">
        {variant !== "quiet" && (
          <button className="button button--primary" disabled={busy} onClick={() => onAction("open", item)}>
            Open in Codex <ArrowUpRight size={15} />
          </button>
        )}
        {variant === "quiet" && (
          <button className="button button--ghost" disabled={busy} onClick={() => onAction("focus", item)}>
            <Focus size={15} /> Protect this thread
          </button>
        )}
        {variant === "review" && (
          <button className="button button--ghost" disabled={busy} onClick={() => onAction("handled", item)}>
            <Check size={15} /> Handled
          </button>
        )}
        <button className="button button--ghost" disabled={busy} onClick={() => onAction("snooze", item)}>
          <Clock3 size={15} /> 30m
        </button>
      </div>
    </article>
  );
}

function EmptyLane({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty-lane">
      <Coffee size={18} />
      <span>{children}</span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <Logo />
      <div className="loading-line" />
      <p>Listening for the moments that actually need you.</p>
    </main>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<DepthlineSnapshot>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await api.snapshot();
      setSnapshot(next);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Depthline could not refresh.");
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 4_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const visibleItems = useMemo(
    () => snapshot?.items.filter((item) => !item.snoozedUntil) ?? [],
    [snapshot],
  );
  const decisions = visibleItems.filter((item) => item.urgency === "blocking");
  const working = visibleItems.filter((item) => item.state === "working");
  const reviews = visibleItems.filter((item) => item.state === "ready_review");
  const primaryThread =
    visibleItems.find((item) => item.isFocused) ?? decisions[0] ?? working[0] ?? reviews[0];

  const runAction = async (
    action: "focus" | "snooze" | "handled" | "open",
    item: AttentionItem,
  ) => {
    setBusy(true);
    try {
      const next =
        action === "focus"
          ? await api.startFocus(50, item.id)
          : action === "snooze"
            ? await api.snooze(item.id)
            : action === "handled"
              ? await api.handled(item.id)
              : await api.open(item.id);
      setSnapshot(next);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const runFocus = async (action: "start" | "stop", threadId?: string) => {
    setBusy(true);
    try {
      const next = action === "start" ? await api.startFocus(50, threadId) : await api.stopFocus();
      setSnapshot(next);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The focus action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) return <LoadingScreen />;

  const remaining = focusMinutes(snapshot);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar-meta">
          <span className={`connection-dot connection-dot--${snapshot.connection}`} />
          <span>{snapshot.mode === "codex" ? "Local Codex" : "Sample workspace"}</span>
          <span className="privacy-label"><ShieldCheck size={14} /> local-only</span>
        </div>
      </header>

      {(snapshot.warning || error) && (
        <div className="notice" role="status">
          <CircleAlert size={17} />
          <span>{error || snapshot.warning}</span>
        </div>
      )}

      <main>
        <section className={`focus-hero ${snapshot.focus.active ? "focus-hero--active" : ""}`}>
          <div className="focus-copy">
            <p className="eyebrow">
              {snapshot.focus.active ? <MoonStar size={16} /> : <Sparkles size={16} />}
              {snapshot.focus.active ? "Depth protected" : "Human attention is the control plane"}
            </p>
            <h1>
              {snapshot.focus.active
                ? `${remaining} minutes without shallow switching.`
                : "Let the agents run. Keep one thought alive."}
            </h1>
            <p className="hero-support">
              {snapshot.focus.active
                ? `${snapshot.focus.suppressedCount} non-blocking work items are staying quiet. Only a genuine decision should reach you.`
                : "Depthline separates real human decisions from progress noise, then restores the context when you choose to return."}
            </p>
            <div className="hero-actions">
              {snapshot.focus.active ? (
                <button className="button button--light" disabled={busy} onClick={() => void runFocus("stop")}>
                  <TimerReset size={17} /> End focus session
                </button>
              ) : (
                <>
                  <button
                    className="button button--light"
                    disabled={busy}
                    onClick={() => void runFocus("start", primaryThread?.id)}
                  >
                    <Play size={17} /> Start 50-minute depth block
                  </button>
                  <span className="hero-hint"><BellOff size={15} /> Batch everything non-blocking</span>
                </>
              )}
            </div>
          </div>
          <div className="bandwidth-card" aria-label="Human bandwidth summary">
            <span className="bandwidth-label">Human bandwidth</span>
            <strong>{snapshot.summary.needsYou}</strong>
            <span>{snapshot.summary.needsYou === 1 ? "decision needs" : "decisions need"} you now</span>
            <div className="bandwidth-breakdown">
              <div><span>Quietly working</span><b>{snapshot.summary.workingQuietly}</b></div>
              <div><span>Batch review</span><b>{snapshot.summary.readyForReview}</b></div>
              <div><span>Parked</span><b>{snapshot.summary.parked}</b></div>
            </div>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--ink"><CircleAlert size={15} /> Decision inbox</p>
              <h2>Only the moments that require a human</h2>
            </div>
            <span>{decisions.length} blocking</span>
          </div>
          {decisions.length ? (
            <div className="decision-grid">
              {decisions.map((item) => (
                <ItemCard key={item.id} item={item} busy={busy} onAction={runAction} />
              ))}
            </div>
          ) : (
            <EmptyLane>No agent needs your judgment right now.</EmptyLane>
          )}
        </section>

        <section className="section-block section-block--quiet">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--ink"><LoaderCircle size={15} /> Quiet lane</p>
              <h2>Work that should not occupy your mind</h2>
            </div>
            <span>{working.length} running</span>
          </div>
          {working.length ? (
            <div className="quiet-grid">
              {working.map((item) => (
                <ItemCard key={item.id} item={item} variant="quiet" busy={busy} onAction={runAction} />
              ))}
            </div>
          ) : (
            <EmptyLane>No background work is running.</EmptyLane>
          )}
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--ink"><Check size={15} /> Review batch</p>
              <h2>Return when your current thought is complete</h2>
            </div>
            <span>{reviews.length} ready</span>
          </div>
          {reviews.length ? (
            <div className="review-grid">
              {reviews.map((item) => (
                <ItemCard key={item.id} item={item} variant="review" busy={busy} onAction={runAction} />
              ))}
            </div>
          ) : (
            <EmptyLane>No completed work is waiting for review.</EmptyLane>
          )}
        </section>
      </main>

      <footer>
        <div>
          <Logo />
          <p>Protect human depth in the age of parallel intelligence.</p>
        </div>
        <p>Raw Codex content stays in memory and is never persisted by Depthline.</p>
      </footer>
    </div>
  );
}
