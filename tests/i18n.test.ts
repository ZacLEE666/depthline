import { describe, expect, it } from "vitest";
import { copy, formatRelativeTime, localizeRuntimeMessage, resolveLocale } from "../src/client/i18n";

describe("interface localization", () => {
  it("follows the browser language when no preference exists", () => {
    expect(resolveLocale(null, "zh-CN")).toBe("zh-CN");
    expect(resolveLocale(null, "en-US")).toBe("en");
  });

  it("keeps an explicit language preference", () => {
    expect(resolveLocale("en", "zh-CN")).toBe("en");
  });

  it("formats relative time in both languages", () => {
    const now = new Date("2026-07-20T05:00:00.000Z").getTime();
    const date = "2026-07-20T04:30:00.000Z";
    expect(formatRelativeTime(date, "en", now)).toBe("30m ago");
    expect(formatRelativeTime(date, "zh-CN", now)).toBe("30 分钟前");
  });

  it("localizes the known Codex fallback warning without hiding diagnostics", () => {
    const message = "Codex is unavailable, so Depthline is showing sample work. spawn codex ENOENT";
    expect(localizeRuntimeMessage(message, "zh-CN")).toContain("正在显示示例任务");
    expect(localizeRuntimeMessage(message, "zh-CN")).toContain("spawn codex ENOENT");
  });

  it("localizes deterministic next actions while preserving their state meaning", () => {
    expect(copy.en.nextActions.ready_review).toContain("definition of done");
    expect(copy["zh-CN"].nextActions.ready_review).toContain("完成定义");
  });
});
