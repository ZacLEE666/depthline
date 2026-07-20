import type { AttentionState } from "../shared/types";

export type Locale = "zh-CN" | "en";

export interface Copy {
  documentTitle: string;
  documentDescription: string;
  languageLabel: string;
  stateLabels: Record<AttentionState, string>;
  nextActions: Record<AttentionState, string>;
  justNow: string;
  minutesAgo: (count: number) => string;
  hoursAgo: (count: number) => string;
  daysAgo: (count: number) => string;
  latest: string;
  nextHumanMove: string;
  openInCodex: string;
  protectThread: string;
  handled: string;
  snooze30: string;
  loading: string;
  refreshFailed: string;
  actionFailed: string;
  focusActionFailed: string;
  localCodex: string;
  sampleWorkspace: string;
  localOnly: string;
  depthProtected: string;
  attentionControlPlane: string;
  focusTitle: (minutes: number) => string;
  idleTitle: string;
  focusSupport: (count: number) => string;
  idleSupport: string;
  endFocus: string;
  startFocus: string;
  batchNonBlocking: string;
  bandwidthAria: string;
  humanBandwidth: string;
  decisionsNeedYou: (count: number) => string;
  quietlyWorking: string;
  batchReview: string;
  parked: string;
  decisionInbox: string;
  decisionHeading: string;
  blockingCount: (count: number) => string;
  noDecision: string;
  quietLane: string;
  quietHeading: string;
  runningCount: (count: number) => string;
  noBackground: string;
  reviewBatch: string;
  reviewHeading: string;
  readyCount: (count: number) => string;
  noReview: string;
  footerVision: string;
  footerPrivacy: string;
}

export const copy: Record<Locale, Copy> = {
  en: {
    documentTitle: "Depthline — Human depth, protected",
    documentDescription: "Depthline protects human depth while AI agents work in parallel.",
    languageLabel: "Interface language",
    stateLabels: {
      needs_input: "Needs your judgment",
      needs_approval: "Approval requested",
      error: "Needs recovery",
      ready_review: "Ready for review",
      working: "Working quietly",
      parked: "Parked",
    },
    nextActions: {
      needs_input: "Answer the smallest unresolved question so the agent can continue.",
      needs_approval: "Review the requested action and approve or reject it in Codex.",
      error: "Inspect the failed turn, then retry or change direction.",
      ready_review: "Review the result against the task's definition of done.",
      working: "No action. Let the agent work quietly.",
      parked: "Leave parked until this work becomes relevant again.",
    },
    justNow: "just now",
    minutesAgo: (count) => `${count}m ago`,
    hoursAgo: (count) => `${count}h ago`,
    daysAgo: (count) => `${count}d ago`,
    latest: "Latest",
    nextHumanMove: "Next human move",
    openInCodex: "Open in Codex",
    protectThread: "Protect this thread",
    handled: "Handled",
    snooze30: "30m",
    loading: "Listening for the moments that actually need you.",
    refreshFailed: "Depthline could not refresh.",
    actionFailed: "The action failed.",
    focusActionFailed: "The focus action failed.",
    localCodex: "Local Codex",
    sampleWorkspace: "Sample workspace",
    localOnly: "local-only",
    depthProtected: "Depth protected",
    attentionControlPlane: "Human attention is the control plane",
    focusTitle: (minutes) => `${minutes} minutes without shallow switching.`,
    idleTitle: "Let the agents run. Keep one thought alive.",
    focusSupport: (count) =>
      `${count} non-blocking work items are staying quiet. Only a genuine decision should reach you.`,
    idleSupport:
      "Depthline separates real human decisions from progress noise, then restores the context when you choose to return.",
    endFocus: "End focus session",
    startFocus: "Start 50-minute depth block",
    batchNonBlocking: "Batch everything non-blocking",
    bandwidthAria: "Human bandwidth summary",
    humanBandwidth: "Human bandwidth",
    decisionsNeedYou: (count) => `${count === 1 ? "decision needs" : "decisions need"} you now`,
    quietlyWorking: "Quietly working",
    batchReview: "Batch review",
    parked: "Parked",
    decisionInbox: "Decision inbox",
    decisionHeading: "Only the moments that require a human",
    blockingCount: (count) => `${count} blocking`,
    noDecision: "No agent needs your judgment right now.",
    quietLane: "Quiet lane",
    quietHeading: "Work that should not occupy your mind",
    runningCount: (count) => `${count} running`,
    noBackground: "No background work is running.",
    reviewBatch: "Review batch",
    reviewHeading: "Return when your current thought is complete",
    readyCount: (count) => `${count} ready`,
    noReview: "No completed work is waiting for review.",
    footerVision: "Protect human depth in the age of parallel intelligence.",
    footerPrivacy: "Raw Codex content stays in memory and is never persisted by Depthline.",
  },
  "zh-CN": {
    documentTitle: "Depthline — 让深度思考不被打断",
    documentDescription: "当 AI Agent 并行工作时，Depthline 帮助人类守住思考深度。",
    languageLabel: "界面语言",
    stateLabels: {
      needs_input: "需要你的判断",
      needs_approval: "等待你的审批",
      error: "需要恢复",
      ready_review: "等待验收",
      working: "安静执行中",
      parked: "已停放",
    },
    nextActions: {
      needs_input: "回答最小的未决问题，让 Agent 继续执行。",
      needs_approval: "检查请求的操作，并在 Codex 中批准或拒绝。",
      error: "检查失败的轮次，然后重试或调整方向。",
      ready_review: "按照任务的完成定义验收结果。",
      working: "无需操作，让 Agent 安静执行。",
      parked: "保持停放，等这项工作重新相关时再处理。",
    },
    justNow: "刚刚",
    minutesAgo: (count) => `${count} 分钟前`,
    hoursAgo: (count) => `${count} 小时前`,
    daysAgo: (count) => `${count} 天前`,
    latest: "最新进展",
    nextHumanMove: "下一步人工动作",
    openInCodex: "在 Codex 中打开",
    protectThread: "保护这条思路",
    handled: "已处理",
    snooze30: "30 分钟后",
    loading: "正在识别真正需要你介入的时刻。",
    refreshFailed: "Depthline 暂时无法刷新。",
    actionFailed: "操作未能完成。",
    focusActionFailed: "专注模式操作未能完成。",
    localCodex: "本机 Codex",
    sampleWorkspace: "示例工作区",
    localOnly: "仅本机",
    depthProtected: "深度思考已保护",
    attentionControlPlane: "人的注意力才是控制平面",
    focusTitle: (minutes) => `${minutes} 分钟，不再进行浅层切换。`,
    idleTitle: "让 Agent 继续运行，只保留一条人的思路。",
    focusSupport: (count) =>
      `${count} 项非阻塞工作正在保持安静。只有真正需要判断的事项才应打断你。`,
    idleSupport: "Depthline 将人的真实决策与进度噪音分开，并在你选择返回时恢复最小必要上下文。",
    endFocus: "结束本次专注",
    startFocus: "开始 50 分钟深度工作",
    batchNonBlocking: "非阻塞事项统一批处理",
    bandwidthAria: "人的注意力概览",
    humanBandwidth: "人的注意力带宽",
    decisionsNeedYou: (count) => `现在有 ${count} 项决策需要你`,
    quietlyWorking: "安静执行",
    batchReview: "批量验收",
    parked: "已停放",
    decisionInbox: "决策收件箱",
    decisionHeading: "这里只保留真正需要人的时刻",
    blockingCount: (count) => `${count} 项阻塞`,
    noDecision: "现在没有 Agent 需要你的判断。",
    quietLane: "安静执行区",
    quietHeading: "这些工作不应占据你的大脑",
    runningCount: (count) => `${count} 项运行中`,
    noBackground: "当前没有后台任务运行。",
    reviewBatch: "批量验收区",
    reviewHeading: "完成当前思考后再回来验收",
    readyCount: (count) => `${count} 项待验收`,
    noReview: "当前没有已完成工作等待验收。",
    footerVision: "在并行智能时代，保护人类思考的深度。",
    footerPrivacy: "Codex 原始内容只存在于内存中，Depthline 永不持久化保存。",
  },
};

export function resolveLocale(stored: string | null, browserLanguage: string): Locale {
  if (stored === "zh-CN" || stored === "en") return stored;
  return browserLanguage.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function formatRelativeTime(date: string, locale: Locale, now = Date.now()): string {
  const messages = copy[locale];
  const minutes = Math.max(0, Math.floor((now - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return messages.justNow;
  if (minutes < 60) return messages.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return messages.hoursAgo(hours);
  return messages.daysAgo(Math.floor(hours / 24));
}

export function localizeRuntimeMessage(message: string, locale: Locale): string {
  if (locale === "en") return message;
  const unavailable = "Codex is unavailable, so Depthline is showing sample work.";
  if (message.startsWith(unavailable)) {
    return `Codex 暂不可用，Depthline 正在显示示例任务。${message.slice(unavailable.length)}`;
  }
  const known: Record<string, string> = {
    "Depthline could not refresh.": copy[locale].refreshFailed,
    "The action failed.": copy[locale].actionFailed,
    "The focus action failed.": copy[locale].focusActionFailed,
    "Opening Codex is disabled in demo mode.": "示例模式下无法打开 Codex。",
  };
  return known[message] ?? message;
}
