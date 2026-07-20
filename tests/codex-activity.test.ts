import { describe, expect, it } from "vitest";
import { lifecycleActivityFromText } from "../src/server/codex-activity.js";

function event(type: string): string {
  return JSON.stringify({ timestamp: new Date().toISOString(), type: "event_msg", payload: { type } });
}

function call(type: string, name: string, id: string, input = ""): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "response_item",
    payload: { type, name, call_id: id, input },
  });
}

function output(type: string, id: string): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "response_item",
    payload: { type, call_id: id },
  });
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

  it("infers a pending approval from an unmatched patch call", () => {
    expect(lifecycleActivityFromText([
      event("task_started"),
      call("custom_tool_call", "apply_patch", "patch-1", "*** Begin Patch"),
    ].join("\n"))).toBe("waiting_approval");
  });

  it("clears inferred approval after the tool returns", () => {
    expect(lifecycleActivityFromText([
      event("task_started"),
      call("custom_tool_call", "apply_patch", "patch-1", "*** Begin Patch"),
      output("custom_tool_call_output", "patch-1"),
    ].join("\n"))).toBe("working");
  });

  it("infers a user-input wait from an unanswered request", () => {
    expect(lifecycleActivityFromText([
      event("task_started"),
      call("function_call", "request_user_input", "question-1"),
    ].join("\n"))).toBe("waiting_input");
  });

  it("recognizes an escalated command as approval-gated", () => {
    expect(lifecycleActivityFromText([
      event("task_started"),
      call("custom_tool_call", "exec", "exec-1", 'sandbox_permissions: "require_escalated"'),
    ].join("\n"))).toBe("waiting_approval");
  });
});
