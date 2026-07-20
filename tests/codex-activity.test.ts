import { describe, expect, it } from "vitest";
import { lifecycleActivityFromText } from "../src/server/codex-activity.js";

function event(type: string): string {
  return JSON.stringify({ timestamp: new Date().toISOString(), type: "event_msg", payload: { type } });
}

describe("Codex rollout activity", () => {
  it("reports a task as working until a completion event arrives", () => {
    expect(lifecycleActivityFromText([event("task_complete"), event("task_started")].join("\n")))
      .toBe("working");
  });

  it("reports the latest completed lifecycle", () => {
    expect(lifecycleActivityFromText([event("task_started"), event("task_complete")].join("\n")))
      .toBe("complete");
  });

  it("ignores a partial JSONL record at the beginning of a tail", () => {
    expect(lifecycleActivityFromText(`broken fragment\n${event("task_started")}`)).toBe("working");
  });
});
