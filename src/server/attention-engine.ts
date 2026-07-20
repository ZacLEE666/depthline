import path from "node:path";
import type {
  AttentionItem,
  AttentionState,
  DepthlineSnapshot,
  PersistedState,
  Urgency,
} from "../shared/types.js";
import type { CodexThread, CodexThreadItem } from "./codex-types.js";

function sourceLabel(source: unknown): string {
  if (typeof source === "string") return source;
  if (source && typeof source === "object") {
    const firstKey = Object.keys(source)[0];
    if (firstKey) return firstKey;
  }
  return "codex";
}

function lastAgentMessage(thread: CodexThread): string | undefined {
  const items = thread.turns.flatMap((turn) => turn.items ?? []);
  return items
    .filter((item: CodexThreadItem) => item.type === "agentMessage" && item.text)
    .at(-1)?.text;
}

function lastTurnStatus(thread: CodexThread): string | undefined {
  return thread.turns.at(-1)?.status;
}

function trimText(value: string | undefined, max = 180): string {
  const compact = (value ?? "").replace(/\s+/g, " ").trim();
  if (!compact) return "No summary is available yet.";
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function classify(
  thread: CodexThread,
  pendingReviewTurnId?: string,
): { state: AttentionState; urgency: Urgency; score: number } {
  const flags = thread.status.activeFlags ?? [];
  const turn = thread.turns.at(-1);

  if (flags.includes("waitingOnUserInput")) {
    return { state: "needs_input", urgency: "blocking", score: 100 };
  }
  if (flags.includes("waitingOnApproval")) {
    return { state: "needs_approval", urgency: "blocking", score: 96 };
  }
  if (thread.status.type === "systemError" || lastTurnStatus(thread) === "failed") {
    return { state: "error", urgency: "blocking", score: 92 };
  }
  if (thread.status.type === "active" || turn?.status === "inProgress") {
    return { state: "working", urgency: "quiet", score: 5 };
  }
  if (turn?.status === "completed" && pendingReviewTurnId === turn.id) {
    return { state: "ready_review", urgency: "batch", score: 54 };
  }
  return { state: "parked", urgency: "quiet", score: 0 };
}

export function observeThreadTransitions(threads: CodexThread[], state: PersistedState): boolean {
  let changed = false;

  for (const thread of threads) {
    const turn = thread.turns.at(-1);
    if (!turn) continue;

    const existing = state.threadPreferences[thread.id] ?? {};
    const firstObservation = existing.observedTurnId === undefined;
    const turnChanged = existing.observedTurnId !== turn.id;
    const statusChanged = existing.observedTurnStatus !== turn.status;

    if (!turnChanged && !statusChanged) continue;

    const completedAfterObservation =
      !firstObservation &&
      turn.status === "completed" &&
      (turnChanged || existing.observedTurnStatus !== "completed");
    const pendingReviewTurnId = completedAfterObservation
      ? turn.id
      : turnChanged || turn.status !== "completed"
        ? undefined
        : existing.pendingReviewTurnId;

    state.threadPreferences[thread.id] = {
      ...existing,
      observedTurnId: turn.id,
      observedTurnStatus: turn.status,
      pendingReviewTurnId,
    };
    changed = true;
  }

  return changed;
}

function nextActionFor(state: AttentionState): string {
  switch (state) {
    case "needs_input":
      return "Answer the smallest unresolved question so the agent can continue.";
    case "needs_approval":
      return "Review the requested action and approve or reject it in Codex.";
    case "error":
      return "Inspect the failed turn, then retry or change direction.";
    case "ready_review":
      return "Review the result against the task's definition of done.";
    case "working":
      return "No action. Let the agent work quietly.";
    case "parked":
      return "Leave parked until this work becomes relevant again.";
  }
}

export function deriveAttentionItem(
  thread: CodexThread,
  state: PersistedState,
  now = new Date(),
): AttentionItem {
  const preference = state.threadPreferences[thread.id] ?? {};
  const updatedAt = new Date(thread.updatedAt * 1000);
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / 60_000));
  const classification = classify(thread, preference.pendingReviewTurnId);
  const snoozed = preference.snoozedUntil
    ? new Date(preference.snoozedUntil).getTime() > now.getTime()
    : false;
  const title = trimText(thread.name || thread.preview, 88);
  const latest = trimText(lastAgentMessage(thread) || thread.preview);
  const stateResult = snoozed
    ? { ...classification, urgency: "quiet" as const, score: 0 }
    : classification;

  return {
    id: thread.id,
    title,
    project: path.basename(thread.cwd) || thread.cwd,
    cwd: thread.cwd,
    source: sourceLabel(thread.source),
    state: stateResult.state,
    urgency: stateResult.urgency,
    interruptionScore: preference.pinned
      ? Math.min(100, stateResult.score + 8)
      : stateResult.score,
    updatedAt: updatedAt.toISOString(),
    ageMinutes,
    capsule: {
      goal: trimText(thread.preview, 150),
      latest,
      nextAction: snoozed
        ? `Snoozed until ${new Date(preference.snoozedUntil!).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}.`
        : nextActionFor(stateResult.state),
    },
    snoozedUntil: snoozed ? preference.snoozedUntil : undefined,
    isFocused:
      state.focus?.threadId === thread.id &&
      Boolean(state.focus?.until && new Date(state.focus.until).getTime() > now.getTime()),
  };
}

export function buildSnapshot(
  threads: CodexThread[],
  state: PersistedState,
  options: {
    mode: "codex" | "demo";
    connection: "connected" | "connecting" | "degraded";
    warning?: string;
    now?: Date;
  },
): DepthlineSnapshot {
  const now = options.now ?? new Date();
  const focusUntil = state.focus?.until ? new Date(state.focus.until) : undefined;
  const focusActive = Boolean(focusUntil && focusUntil.getTime() > now.getTime());
  const items = threads
    .map((thread) => deriveAttentionItem(thread, state, now))
    .sort((a, b) => b.interruptionScore - a.interruptionScore || b.updatedAt.localeCompare(a.updatedAt));
  const visibleItems = items.filter((item) => !item.snoozedUntil);

  return {
    mode: options.mode,
    connection: options.connection,
    generatedAt: now.toISOString(),
    items,
    focus: {
      active: focusActive,
      until: focusActive ? state.focus?.until : undefined,
      threadId: focusActive ? state.focus?.threadId : undefined,
      suppressedCount: focusActive
        ? visibleItems.filter((item) => item.urgency !== "blocking").length
        : 0,
    },
    summary: {
      needsYou: visibleItems.filter((item) => item.urgency === "blocking").length,
      workingQuietly: visibleItems.filter((item) => item.state === "working").length,
      readyForReview: visibleItems.filter((item) => item.state === "ready_review").length,
      parked: visibleItems.filter((item) => item.state === "parked").length,
    },
    privacy: {
      rawContentPersisted: false,
      bindAddress: "127.0.0.1",
    },
    warning: options.warning,
  };
}
