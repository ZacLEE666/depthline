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
import {
  copy,
  formatRelativeTime,
  localizeRuntimeMessage,
  resolveLocale,
  type Copy,
  type Locale,
} from "./i18n";

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
  opening: boolean;
  locale: Locale;
  messages: Copy;
  onAction: (action: "focus" | "snooze" | "handled" | "open", item: AttentionItem) => void;
}

function ItemCard({ item, variant = "decision", busy, opening, locale, messages, onAction }: ItemCardProps) {
  return (
    <article className={`item-card item-card--${variant}`}>
      <div className="item-topline">
        <span className={`state-pill state-pill--${item.state}`}>
          <StateIcon state={item.state} />
          {messages.stateLabels[item.state]}
        </span>
        <span className="item-time">{formatRelativeTime(item.updatedAt, locale)}</span>
      </div>
      <div>
        <p className="item-project">{item.project}</p>
        <h3>{item.title}</h3>
      </div>
      {variant !== "quiet" && (
        <div className="capsule">
          <div>
            <span>{messages.latest}</span>
            <p>{item.capsule.latest}</p>
          </div>
          <div>
            <span>{messages.nextHumanMove}</span>
            <p>{messages.nextActions[item.state]}</p>
          </div>
        </div>
      )}
      <div className="item-actions">
        {variant !== "quiet" && (
          <button className="button button--primary" disabled={busy} onClick={() => onAction("open", item)}>
            {opening ? messages.openingCodex : messages.openInCodex} <ArrowUpRight size={15} />
          </button>
        )}
        {variant === "quiet" && (
          <button className="button button--ghost" disabled={busy} onClick={() => onAction("focus", item)}>
            <Focus size={15} /> {messages.protectThread}
          </button>
        )}
        {variant === "review" && (
          <button className="button button--ghost" disabled={busy} onClick={() => onAction("handled", item)}>
            <Check size={15} /> {messages.handled}
          </button>
        )}
        <button className="button button--ghost" disabled={busy} onClick={() => onAction("snooze", item)}>
          <Clock3 size={15} /> {messages.snooze30}
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

function LoadingScreen({ messages }: { messages: Copy }) {
  return (
    <main className="loading-screen">
      <Logo />
      <div className="loading-line" />
      <p>{messages.loading}</p>
    </main>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(window.localStorage.getItem("depthline.locale"), window.navigator.language),
  );
  const [snapshot, setSnapshot] = useState<DepthlineSnapshot>();
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [openingItemId, setOpeningItemId] = useState<string>();
  const messages = copy[locale];

  useEffect(() => {
    window.localStorage.setItem("depthline.locale", locale);
    document.documentElement.lang = locale;
    document.title = messages.documentTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", messages.documentDescription);
  }, [locale, messages]);

  const load = useCallback(async () => {
    try {
      const next = await api.snapshot();
      setSnapshot(next);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.refreshFailed);
    }
  }, [messages.refreshFailed]);

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
    setOpeningItemId(action === "open" ? item.id : undefined);
    setFeedback(undefined);
    try {
      if (action === "open") {
        await api.open(item.id);
        setFeedback(messages.openedWorkspace);
      } else {
        const next =
          action === "focus"
            ? await api.startFocus(50, item.id)
            : action === "snooze"
              ? await api.snooze(item.id)
              : await api.handled(item.id);
        setSnapshot(next);
      }
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.actionFailed);
    } finally {
      setBusy(false);
      setOpeningItemId(undefined);
    }
  };

  const runFocus = async (action: "start" | "stop", threadId?: string) => {
    setBusy(true);
    try {
      const next = action === "start" ? await api.startFocus(50, threadId) : await api.stopFocus();
      setSnapshot(next);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.focusActionFailed);
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) return <LoadingScreen messages={messages} />;

  const remaining = focusMinutes(snapshot);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar-meta">
          <span className={`connection-dot connection-dot--${snapshot.connection}`} />
          <span>{snapshot.mode === "codex" ? messages.localCodex : messages.sampleWorkspace}</span>
          <span className="privacy-label"><ShieldCheck size={14} /> {messages.localOnly}</span>
          <div className="language-switch" role="group" aria-label={messages.languageLabel}>
            <button
              type="button"
              aria-pressed={locale === "zh-CN"}
              onClick={() => setLocale("zh-CN")}
            >
              中文
            </button>
            <button
              type="button"
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {(snapshot.warning || error) && (
        <div className="notice" role="status">
          <CircleAlert size={17} />
          <span>{localizeRuntimeMessage(error || snapshot.warning || "", locale)}</span>
        </div>
      )}
      {feedback && !snapshot.warning && !error && (
        <div className="notice notice--success" role="status">
          <Check size={17} />
          <span>{feedback}</span>
        </div>
      )}

      <main>
        <section className={`focus-hero ${snapshot.focus.active ? "focus-hero--active" : ""}`}>
          <div className="focus-copy">
            <p className="eyebrow">
              {snapshot.focus.active ? <MoonStar size={16} /> : <Sparkles size={16} />}
              {snapshot.focus.active ? messages.depthProtected : messages.attentionControlPlane}
            </p>
            <h1>
              {snapshot.focus.active
                ? messages.focusTitle(remaining)
                : messages.idleTitle}
            </h1>
            <p className="hero-support">
              {snapshot.focus.active
                ? messages.focusSupport(snapshot.focus.suppressedCount)
                : messages.idleSupport}
            </p>
            <div className="hero-actions">
              {snapshot.focus.active ? (
                <button className="button button--light" disabled={busy} onClick={() => void runFocus("stop")}>
                  <TimerReset size={17} /> {messages.endFocus}
                </button>
              ) : (
                <>
                  <button
                    className="button button--light"
                    disabled={busy}
                    onClick={() => void runFocus("start", primaryThread?.id)}
                  >
                    <Play size={17} /> {messages.startFocus}
                  </button>
                  <span className="hero-hint"><BellOff size={15} /> {messages.batchNonBlocking}</span>
                </>
              )}
            </div>
          </div>
          <div className="bandwidth-card" aria-label={messages.bandwidthAria}>
            <span className="bandwidth-label">{messages.humanBandwidth}</span>
            <strong>{snapshot.summary.needsYou}</strong>
            <span>{messages.decisionsNeedYou(snapshot.summary.needsYou)}</span>
            <div className="bandwidth-breakdown">
              <div><span>{messages.quietlyWorking}</span><b>{snapshot.summary.workingQuietly}</b></div>
              <div><span>{messages.batchReview}</span><b>{snapshot.summary.readyForReview}</b></div>
              <div><span>{messages.parked}</span><b>{snapshot.summary.parked}</b></div>
            </div>
          </div>
        </section>

        <section className={`section-block ${decisions.length ? "" : "section-block--empty"}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--ink"><CircleAlert size={15} /> {messages.decisionInbox}</p>
              <h2>{messages.decisionHeading}</h2>
            </div>
            <span>{messages.blockingCount(decisions.length)}</span>
          </div>
          {decisions.length ? (
            <div className="decision-grid">
              {decisions.map((item) => (
                <ItemCard key={item.id} item={item} busy={busy} opening={openingItemId === item.id} locale={locale} messages={messages} onAction={runAction} />
              ))}
            </div>
          ) : (
            <EmptyLane>{messages.noDecision}</EmptyLane>
          )}
        </section>

        <section className={`section-block section-block--quiet ${working.length ? "" : "section-block--empty"}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--ink"><LoaderCircle size={15} /> {messages.quietLane}</p>
              <h2>{messages.quietHeading}</h2>
            </div>
            <span>{messages.runningCount(working.length)}</span>
          </div>
          {working.length ? (
            <div className="quiet-grid">
              {working.map((item) => (
                <ItemCard key={item.id} item={item} variant="quiet" busy={busy} opening={false} locale={locale} messages={messages} onAction={runAction} />
              ))}
            </div>
          ) : (
            <EmptyLane>{messages.noBackground}</EmptyLane>
          )}
        </section>

        <section className={`section-block ${reviews.length ? "" : "section-block--empty"}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--ink"><Check size={15} /> {messages.reviewBatch}</p>
              <h2>{messages.reviewHeading}</h2>
            </div>
            <span>{messages.readyCount(reviews.length)}</span>
          </div>
          {reviews.length ? (
            <div className="review-grid">
              {reviews.map((item) => (
                <ItemCard key={item.id} item={item} variant="review" busy={busy} opening={openingItemId === item.id} locale={locale} messages={messages} onAction={runAction} />
              ))}
            </div>
          ) : (
            <EmptyLane>{messages.noReview}</EmptyLane>
          )}
        </section>
      </main>

      <footer>
        <div>
          <Logo />
          <p>{messages.footerVision}</p>
        </div>
        <p>{messages.footerPrivacy}</p>
      </footer>
    </div>
  );
}
