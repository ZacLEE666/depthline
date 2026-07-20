import { describe, expect, it } from "vitest";
import { buildSnapshot, deriveAttentionItem } from "../src/server/attention-engine.js";
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

  it("batches a recently completed turn for review", () => {
    const item = deriveAttentionItem(thread(), state(), now);

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
