export interface CodexThreadStatus {
  type: "notLoaded" | "idle" | "systemError" | "active";
  activeFlags?: Array<"waitingOnApproval" | "waitingOnUserInput">;
}

export interface CodexThreadItem {
  id: string;
  type: string;
  text?: string;
  content?: unknown[];
}

export interface CodexTurn {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
  items: CodexThreadItem[];
  completedAt?: number | null;
  startedAt?: number | null;
}

export interface CodexThread {
  id: string;
  name?: string | null;
  preview: string;
  cwd: string;
  source: unknown;
  status: CodexThreadStatus;
  createdAt: number;
  updatedAt: number;
  turns: CodexTurn[];
}

export interface CodexThreadListResponse {
  data: CodexThread[];
  nextCursor?: string | null;
}

export interface CodexThreadReadResponse {
  thread: CodexThread;
}
