import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  deriveAttentionItem,
  displayTitle,
  observeThreadTransitions,
} from "../src/server/attention-engine.js";
import type { CodexThread } from "../src/server/codex-types.js";
import type { PersistedState } from "../src/shared/types.js";

const now = new Date("2026-07-20T08:00:00.000Z");

function thread(overrides: Partial<CodexThread> = {}): CodexThread {
  return {
    id: "thread-1",
    name: "Protect the current thought",
    preview: "Keep the human focused while agents work.",
    cwd: "/Projects/depthline",
    source: "appServer",
    status: { type: "idle" },
    createdAt: now.getTime() / 1000 - 3_600,
    updatedAt: now.getTime() / 1000 - 300,
    turns: [
      {
        id: "turn-1",
        status: "completed",
        items: [{ id: "message-1", type: "agentMessage", text: "The work is ready." }],
      },
    ],
    ...overrides,
  };
}

function state(): PersistedState {
  return { version: 1, threadPreferences: {} };
}

describe("attention engine", () => {
  it("turns an AI-generated summary into a compact task title", () => {
    expect(displayTitle(
      "AI总结 双方讨论候选人学历破格录用可能性，重点分析其广州属地化工作与异地团队的协同难题。涉及产品经理岗位适配性评估。",
    )).toBe("候选人学历破格录用可能性 · 广州属地化工作与异地团队的协同难题");
  });

  it("caps ordinary task titles before they can dominate a card", () => {
    expect(displayTitle("A".repeat(80))).toBe(`${"A".repeat(47)}…`);
  });

  it("routes a user-input wait to the blocking inbox", () => {
    const item = deriveAttentionItem(
      thread({ status: { type: "active", activeFlags: ["waitingOnUserInput"] } }),
      state(),
      now,
    );

    expect(item.state).toBe("needs_input");
    expect(item.urgency).toBe("blocking");
    expect(item.interruptionScore).toBe(100);
  });

  it("keeps active work quiet when no human action is required", () => {
    const item = deriveAttentionItem(
      thread({ status: { type: "active", activeFlags: [] } }),
      state(),
      now,
    );

    expect(item.state).toBe("working");
    expect(item.urgency).toBe("quiet");
  });

  it("exposes a persisted follow marker without changing semantic state", () => {
    const persisted = state();
    persisted.threadPreferences["thread-1"] = { pinned: true };
    const item = deriveAttentionItem(thread(), persisted, now);

    expect(item.isFollowed).toBe(true);
    expect(item.state).toBe("parked");
  });

  it("batches a recently completed turn for review", () => {
    const persisted = state();
    persisted.threadPreferences["thread-1"] = { pendingReviewTurnId: "turn-1" };
    const item = deriveAttentionItem(thread(), persisted, now);

    expect(item.state).toBe("ready_review");
    expect(item.urgency).toBe("batch");
    expect(item.capsule.latest).toBe("The work is ready.");
  });

  it("does not resurface a result already handled after its update", () => {
    const persisted = state();
    persisted.threadPreferences["thread-1"] = {
      handledAt: "2026-07-20T08:01:00.000Z",
    };

    expect(deriveAttentionItem(thread(), persisted, now).state).toBe("parked");
  });

  it("parks historical completed work on first observation", () => {
    const persisted = state();
    observeThreadTransitions([thread()], persisted);

    expect(deriveAttentionItem(thread(), persisted, now).state).toBe("parked");
    expect(persisted.threadPreferences["thread-1"].pendingReviewTurnId).toBeUndefined();
  });

  it("creates review work only when an observed turn actually completes", () => {
    const persisted = state();
    const running = thread({
      status: { type: "idle" },
      turns: [{ id: "turn-1", status: "inProgress", items: [] }],
    });
    observeThreadTransitions([running], persisted);

    expect(deriveAttentionItem(running, persisted, now).state).toBe("working");

    const completed = thread();
    observeThreadTransitions([completed], persisted);

    expect(persisted.threadPreferences["thread-1"].pendingReviewTurnId).toBe("turn-1");
    expect(deriveAttentionItem(completed, persisted, now).state).toBe("ready_review");
  });

  it("recognizes an in-progress turn even when the thread status is idle", () => {
    const running = thread({
      status: { type: "idle" },
      turns: [{ id: "turn-1", status: "inProgress", items: [] }],
    });

    expect(deriveAttentionItem(running, state(), now).state).toBe("working");
  });

  it("silences a snoozed blocking item without changing its semantic state", () => {
    const persisted = state();
    persisted.threadPreferences["thread-1"] = {
      snoozedUntil: "2026-07-20T08:30:00.000Z",
    };
    const item = deriveAttentionItem(
      thread({ status: { type: "active", activeFlags: ["waitingOnApproval"] } }),
      persisted,
      now,
    );

    expect(item.state).toBe("needs_approval");
    expect(item.urgency).toBe("quiet");
    expect(item.interruptionScore).toBe(0);
  });

  it("counts only unsnoozed blocking work in human bandwidth", () => {
    const persisted = state();
    persisted.focus = { until: "2026-07-20T09:00:00.000Z" };
    persisted.threadPreferences["snoozed"] = {
      snoozedUntil: "2026-07-20T08:30:00.000Z",
    };
    const snapshot = buildSnapshot(
      [
        thread({ id: "blocking", status: { type: "active", activeFlags: ["waitingOnUserInput"] } }),
        thread({ id: "snoozed", status: { type: "active", activeFlags: ["waitingOnApproval"] } }),
        thread({ id: "working", status: { type: "active", activeFlags: [] } }),
      ],
      persisted,
      { mode: "codex", connection: "connected", now },
    );

    expect(snapshot.summary.needsYou).toBe(1);
    expect(snapshot.summary.workingQuietly).toBe(1);
    expect(snapshot.focus.active).toBe(true);
  });

  it("does not mark an expired focus target as focused", () => {
    const persisted = state();
    persisted.focus = { threadId: "thread-1", until: "2026-07-20T07:59:00.000Z" };

    expect(deriveAttentionItem(thread(), persisted, now).isFocused).toBe(false);
  });
});
