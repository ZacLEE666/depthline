import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStateStore } from "../src/server/store.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("LocalStateStore", () => {
  it("starts empty and writes only attention metadata", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "depthline-test-"));
    directories.push(directory);
    const store = new LocalStateStore(directory);

    expect(await store.read()).toEqual({ version: 1, threadPreferences: {} });

    await store.update((state) => {
      state.threadPreferences["thread-1"] = { handledAt: "2026-07-20T08:00:00.000Z" };
    });

    const raw = await readFile(store.filePath, "utf8");
    expect(raw).toContain("thread-1");
    expect(raw).not.toContain("prompt");
    expect((await store.read()).threadPreferences["thread-1"]?.handledAt).toBeTruthy();
  });

  it("persists followed conversations as metadata", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "depthline-follow-test-"));
    directories.push(directory);
    const store = new LocalStateStore(directory);

    await store.update((state) => {
      state.threadPreferences["daily-plan"] = { pinned: true };
    });

    const saved = await store.read();
    expect(saved.threadPreferences["daily-plan"]?.pinned).toBe(true);
    expect(await readFile(store.filePath, "utf8")).not.toContain("conversation content");
  });

  it("persists only the turn marker needed for a delayed decision", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "depthline-delay-test-"));
    directories.push(directory);
    const store = new LocalStateStore(directory);

    await store.update((state) => {
      state.threadPreferences["decision"] = {
        delayedAt: "2026-07-22T08:00:00.000Z",
        delayedTurnId: "turn-1",
      };
    });

    const saved = await store.read();
    expect(saved.threadPreferences.decision?.delayedTurnId).toBe("turn-1");
  });
});
