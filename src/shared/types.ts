export type AttentionState =
  | "needs_input"
  | "needs_approval"
  | "error"
  | "ready_review"
  | "working"
  | "parked";

export type Urgency = "blocking" | "batch" | "quiet";

export interface ContextCapsule {
  goal: string;
  latest: string;
  nextAction: string;
}

export interface AttentionItem {
  id: string;
  title: string;
  project: string;
  cwd: string;
  source: string;
  state: AttentionState;
  urgency: Urgency;
  interruptionScore: number;
  updatedAt: string;
  ageMinutes: number;
  capsule: ContextCapsule;
  snoozedUntil?: string;
  isFocused: boolean;
  isFollowed: boolean;
}

export interface FocusSession {
  active: boolean;
  until?: string;
  threadId?: string;
  suppressedCount: number;
}

export interface SnapshotSummary {
  needsYou: number;
  workingQuietly: number;
  readyForReview: number;
  parked: number;
}

export interface DepthlineSnapshot {
  mode: "codex" | "demo";
  connection: "connected" | "connecting" | "degraded";
  generatedAt: string;
  items: AttentionItem[];
  focus: FocusSession;
  summary: SnapshotSummary;
  privacy: {
    rawContentPersisted: false;
    bindAddress: "127.0.0.1";
  };
  warning?: string;
}

export interface ThreadPreference {
  snoozedUntil?: string;
  handledAt?: string;
  pinned?: boolean;
  observedTurnId?: string;
  observedTurnStatus?: "completed" | "interrupted" | "failed" | "inProgress";
  pendingReviewTurnId?: string;
}

export interface PersistedState {
  version: 1;
  focus?: {
    until: string;
    threadId?: string;
  };
  threadPreferences: Record<string, ThreadPreference>;
}
