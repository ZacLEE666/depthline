import { describe, expect, it } from "vitest";
import { codexThreadUrl } from "../src/server/codex-launcher.js";

describe("Codex deep links", () => {
  it("targets the exact Codex thread", () => {
    expect(codexThreadUrl("019f7d75-1b8c-7643-8747-e1ea11fc5066")).toBe(
      "codex://threads/019f7d75-1b8c-7643-8747-e1ea11fc5066",
    );
  });

  it("encodes unexpected thread identifiers instead of extending the route", () => {
    expect(codexThreadUrl("thread/with spaces")).toBe("codex://threads/thread%2Fwith%20spaces");
  });
});
