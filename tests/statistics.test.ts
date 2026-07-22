import { describe, expect, it } from "vitest";
import { buildAttentionStats } from "../src/client/statistics.js";
import type { AttentionItem, DepthlineSnapshot } from "../src/shared/types.js";

function item(id: string, state: AttentionItem["state"], project: string): AttentionItem {
  return {
    id,
    title: id,
    project,
    cwd: `/Projects/${project}`,
    source: "codex",
    state,
    urgency: ["needs_input", "needs_approval", "error"].includes(state) ? "blocking" : "quiet",
    interruptionScore: 0,
    updatedAt: `2026-07-20T08:0${id.length}:00.000Z`,
    ageMinutes: 0,
    capsule: { goal: "", latest: "", nextAction: "" },
    isFocused: false,
    isFollowed: false,
  };
}

function snapshot(items: AttentionItem[]): DepthlineSnapshot {
  return {
    mode: "codex",
    connection: "connected",
    generatedAt: "2026-07-20T08:00:00.000Z",
    items,
    focus: { active: false, suppressedCount: 0 },
    summary: { needsYou: 1, workingQuietly: 1, readyForReview: 1, delayed: 0, parked: 1 },
    conversationActivity: { today: "2026-07-20", todayTotal: 0, sourceThreadCount: 0, days: [], maxDailyCount: 0, projects: [] },
    privacy: { rawContentPersisted: false, bindAddress: "127.0.0.1" },
  };
}

describe("attention statistics", () => {
  it("calculates protection from non-blocking active work", () => {
    const stats = buildAttentionStats(snapshot([
      item("input", "needs_input", "alpha"),
      item("work", "working", "alpha"),
      item("review", "ready_review", "beta"),
      item("park", "parked", "beta"),
    ]));

    expect(stats.attentionProtectionRate).toBe(67);
    expect(stats.protectedItems).toBe(2);
    expect(stats.parallelLoad).toBe(2);
    expect(stats.projects[0].project).toBe("alpha");
  });

  it("does not invent a rate when there is no attention-bearing work", () => {
    expect(buildAttentionStats(snapshot([item("park", "parked", "alpha")])).attentionProtectionRate)
      .toBeNull();
  });

  it("counts delayed decisions as protected attention without active parallel load", () => {
    const stats = buildAttentionStats(snapshot([
      item("input", "needs_input", "alpha"),
      item("later", "delayed", "alpha"),
    ]));

    expect(stats.attentionProtectionRate).toBe(50);
    expect(stats.protectedItems).toBe(1);
    expect(stats.parallelLoad).toBe(1);
    expect(stats.projects[0].delayed).toBe(1);
  });
});
