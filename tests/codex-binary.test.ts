import { describe, expect, it } from "vitest";
import { resolveCodexBinary } from "../src/server/codex-binary.js";

describe("resolveCodexBinary", () => {
  it("honors an executable configured with an absolute path", async () => {
    const binary = await resolveCodexBinary({
      env: { DEPTHLINE_CODEX_BIN: "/opt/tools/codex", PATH: "" },
      platform: "darwin",
      canExecute: async (candidate) => candidate === "/opt/tools/codex",
    });

    expect(binary).toBe("/opt/tools/codex");
  });

  it("finds Codex on PATH", async () => {
    const binary = await resolveCodexBinary({
      env: { PATH: "/usr/local/bin:/usr/bin" },
      platform: "darwin",
      canExecute: async (candidate) => candidate === "/usr/local/bin/codex",
    });

    expect(binary).toBe("/usr/local/bin/codex");
  });

  it("finds the Codex binary bundled with ChatGPT on macOS", async () => {
    const binary = await resolveCodexBinary({
      env: { PATH: "/usr/bin" },
      platform: "darwin",
      homeDirectory: "/Users/tester",
      canExecute: async (candidate) => candidate === "/Applications/ChatGPT.app/Contents/Resources/codex",
    });

    expect(binary).toBe("/Applications/ChatGPT.app/Contents/Resources/codex");
  });

  it("returns an actionable error when no executable exists", async () => {
    await expect(
      resolveCodexBinary({
        env: { PATH: "/usr/bin" },
        platform: "linux",
        canExecute: async () => false,
      }),
    ).rejects.toThrow("Set DEPTHLINE_CODEX_BIN to the full executable path");
  });
});
