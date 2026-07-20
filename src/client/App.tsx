import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Activity,
  BarChart3,
  Check,
  CircleAlert,
  Clock3,
  Coffee,
  Focus,
  FolderKanban,
  LoaderCircle,
  LayoutList,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Star,
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
import { buildAttentionStats } from "./statistics";

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
  variant?: "decision" | "quiet" | "review" | "follow";
  busy: boolean;
  opening: boolean;
  locale: Locale;
  messages: Copy;
  onAction: (action: "focus" | "snooze" | "handled" | "follow" | "open", item: AttentionItem) => void;
}

function ItemCard({ item, variant = "decision", busy, opening, locale, messages, onAction }: ItemCardProps) {
  return (
    <article className={`item-card item-card--${variant}`}>
      <div className="item-project-row">
        <div className="item-project" title={item.project}>
          <FolderKanban size={14} aria-hidden="true" />
          <span>{item.project}</span>
        </div>
        <div className="item-top-actions">
          <button
            type="button"
            className={`follow-toggle ${item.isFollowed ? "follow-toggle--active" : ""}`}
            aria-label={item.isFollowed ? messages.unfollow : messages.follow}
            title={item.isFollowed ? messages.unfollow : messages.follow}
            aria-pressed={item.isFollowed}
            disabled={busy}
            onClick={() => onAction("follow", item)}
          >
            <Star size={13} fill={item.isFollowed ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <div className="item-meta-row">
        <span className={`state-pill state-pill--${item.state}`}>
          <StateIcon state={item.state} />
          {messages.stateLabels[item.state]}
        </span>
        <span className="item-time">{formatRelativeTime(item.updatedAt, locale)}</span>
      </div>
      <div className="item-title-block">
        <h3 title={item.title}>{item.title}</h3>
      </div>
      <div className="capsule">
        <div className="latest-progress">
          <span>{messages.latest}</span>
          <p>{item.capsule.latest}</p>
        </div>
        {(variant === "decision" || variant === "review") && (
          <div className="human-move">
            <span>{messages.nextHumanMove}</span>
            <p>{messages.nextActions[item.state]}</p>
          </div>
        )}
      </div>
      <div className="item-actions">
        <button className="button button--primary" disabled={busy} onClick={() => onAction("open", item)}>
          {opening ? messages.openingCodex : messages.openInCodex} <ArrowUpRight size={15} />
        </button>
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

function StatisticsView({ snapshot, locale, messages }: { snapshot: DepthlineSnapshot; locale: Locale; messages: Copy }) {
  const stats = buildAttentionStats(snapshot);
  const blocking = stats.stateCounts.needs_input + stats.stateCounts.needs_approval + stats.stateCounts.error;
  const distribution = [
    { key: "blocking", label: messages.statsNeedsYou, value: blocking },
    { key: "working", label: messages.quietlyWorking, value: stats.stateCounts.working },
    { key: "review", label: messages.batchReview, value: stats.stateCounts.ready_review },
    { key: "parked", label: messages.parked, value: stats.stateCounts.parked },
  ];

  return (
    <div className="stats-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow eyebrow--ink"><Activity size={15} /> {messages.statsRealtime}</p>
          <h1>{messages.statsTitle}</h1>
          <p>{messages.statsSupport}</p>
        </div>
        <span>{formatRelativeTime(snapshot.generatedAt, locale)}</span>
      </header>

      <section className="metric-grid" aria-label={messages.statsMetricsAria}>
        <article className="metric-card metric-card--primary">
          <span>{messages.statsProtectionRate}</span>
          <strong>{stats.attentionProtectionRate === null ? "—" : `${stats.attentionProtectionRate}%`}</strong>
          <p>{messages.statsProtectionHelp(stats.protectedItems)}</p>
        </article>
        <article className="metric-card">
          <span>{messages.statsParallelLoad}</span>
          <strong>{stats.parallelLoad}</strong>
          <p>{messages.statsParallelHelp}</p>
        </article>
        <article className="metric-card metric-card--alert">
          <span>{messages.statsNeedsYou}</span>
          <strong>{blocking}</strong>
          <p>{messages.statsNeedsHelp}</p>
        </article>
        <article className="metric-card">
          <span>{messages.statsReviewDebt}</span>
          <strong>{stats.stateCounts.ready_review}</strong>
          <p>{messages.statsReviewHelp}</p>
        </article>
      </section>

      <section className="stats-panel">
        <div className="stats-panel-heading">
          <div><span>{messages.statsStructure}</span><h2>{messages.statsStructureTitle}</h2></div>
          <b>{messages.statsItems(stats.totalVisible)}</b>
        </div>
        <div className="distribution-track" aria-label={messages.statsStructure}>
          {distribution.map((entry) => entry.value > 0 && (
            <span
              key={entry.key}
              className={`distribution-segment distribution-segment--${entry.key}`}
              style={{ width: `${(entry.value / Math.max(1, stats.totalVisible)) * 100}%` }}
              title={`${entry.label}: ${entry.value}`}
            />
          ))}
        </div>
        <div className="distribution-legend">
          {distribution.map((entry) => (
            <div key={entry.key}><i className={`legend-dot legend-dot--${entry.key}`} /><span>{entry.label}</span><b>{entry.value}</b></div>
          ))}
        </div>
      </section>

      <section className="stats-panel">
        <div className="stats-panel-heading">
          <div><span>{messages.statsProjects}</span><h2>{messages.statsProjectsTitle}</h2></div>
        </div>
        <div className="project-table-wrap">
          <table className="project-table">
            <thead><tr><th>{messages.statsProject}</th><th>{messages.statsRunning}</th><th>{messages.statsBlocking}</th><th>{messages.statsAwaitingReview}</th><th>{messages.statsTotal}</th></tr></thead>
            <tbody>
              {stats.projects.map((project) => (
                <tr key={project.project}>
                  <td><strong>{project.project}</strong><span>{formatRelativeTime(project.latestUpdate, locale)}</span></td>
                  <td>{project.working}</td><td>{project.needsYou}</td><td>{project.readyForReview}</td><td>{project.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
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
  const [view, setView] = useState<"work" | "stats">("work");
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
    return api.subscribe(
      (next) => {
        setSnapshot(next);
        setError(undefined);
      },
      () => {
        setSnapshot((current) => current ? { ...current, connection: "degraded" } : current);
        setError(messages.refreshFailed);
      },
    );
  }, [load]);

  const visibleItems = useMemo(
    () => snapshot?.items.filter((item) => !item.snoozedUntil) ?? [],
    [snapshot],
  );
  const followed = snapshot?.items.filter((item) => item.isFollowed) ?? [];
  const decisions = visibleItems.filter((item) => item.urgency === "blocking");
  const working = visibleItems.filter((item) => item.state === "working");
  const reviews = visibleItems.filter((item) => item.state === "ready_review");
  const primaryThread =
    visibleItems.find((item) => item.isFocused) ?? decisions[0] ?? working[0] ?? reviews[0];

  const runAction = async (
    action: "focus" | "snooze" | "handled" | "follow" | "open",
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
              : action === "follow"
                ? await api.follow(item.id, !item.isFollowed)
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
        <div className="topbar-actions">
          <nav className="view-switch" aria-label={messages.navigationLabel}>
            <button aria-pressed={view === "work"} onClick={() => setView("work")}><LayoutList size={14} /> {messages.navigationWork}</button>
            <button aria-pressed={view === "stats"} onClick={() => setView("stats")}><BarChart3 size={14} /> {messages.navigationStats}</button>
          </nav>
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
        {view === "stats" ? <StatisticsView snapshot={snapshot} locale={locale} messages={messages} /> : <>
        <section className={`control-strip ${snapshot.focus.active ? "control-strip--active" : ""}`}>
          <div className="control-copy">
            <p className="eyebrow">{snapshot.focus.active ? messages.depthProtected : messages.workConsole}</p>
            <h1>{snapshot.focus.active ? messages.compactFocusTitle(remaining) : messages.workConsoleTitle}</h1>
            <p>{snapshot.focus.active ? messages.focusSupport(snapshot.focus.suppressedCount) : messages.workConsoleSupport}</p>
          </div>
          <div className="control-actions">
            <div className="summary-row">
              <div><span>{messages.statsNeedsYou}</span><b>{snapshot.summary.needsYou}</b></div>
              <div><span>{messages.quietlyWorking}</span><b>{snapshot.summary.workingQuietly}</b></div>
              <div><span>{messages.batchReview}</span><b>{snapshot.summary.readyForReview}</b></div>
              <div><span>{messages.parked}</span><b>{snapshot.summary.parked}</b></div>
            </div>
            {snapshot.focus.active ? (
              <button className="button button--ghost" disabled={busy} onClick={() => void runFocus("stop")}><TimerReset size={15} /> {messages.endFocus}</button>
            ) : (
              <button className="button button--primary" disabled={busy} onClick={() => void runFocus("start", primaryThread?.id)}><Play size={15} /> {messages.compactStartFocus}</button>
            )}
          </div>
        </section>

        <section className={`section-block section-block--followed ${followed.length ? "" : "section-block--empty"}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--ink"><Star size={14} fill="currentColor" /> {messages.followedSection}</p>
              <h2>{messages.followedHeading}</h2>
            </div>
            <span>{messages.followedCount(followed.length)}</span>
          </div>
          {followed.length ? (
            <div className="follow-grid">
              {followed.map((item) => (
                <ItemCard key={item.id} item={item} variant="follow" busy={busy} opening={openingItemId === item.id} locale={locale} messages={messages} onAction={runAction} />
              ))}
            </div>
          ) : (
            <EmptyLane>{messages.noFollowed}</EmptyLane>
          )}
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
                <ItemCard key={item.id} item={item} variant="quiet" busy={busy} opening={openingItemId === item.id} locale={locale} messages={messages} onAction={runAction} />
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
        </>}
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
