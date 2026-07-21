import { open, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CodexThread } from "./codex-types.js";

const MAX_TAIL_BYTES = 512 * 1024;

type LifecycleActivity =
  | "working"
  | "waiting_approval"
  | "waiting_input"
  | "error"
  | "complete"
  | "interrupted"
  | undefined;

interface RolloutRecord {
  type?: string;
  payload?: {
    type?: string;
    name?: string;
    id?: string;
    call_id?: string;
    arguments?: string;
    input?: string;
    error?: unknown;
  };
}

interface CachedActivity {
  size: number;
  modifiedAt: number;
  activity: LifecycleActivity;
}

export function lifecycleActivityFromText(text: string): LifecycleActivity {
  const lines = text.split("\n");
  let lifecycle: LifecycleActivity;
  const pendingCalls = new Map<string, { name: string; payloadText: string }>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      const record = JSON.parse(line) as RolloutRecord;
      const payload = record.payload;
      if (record.type === "event_msg") {
        if (payload?.type === "task_started") {
          lifecycle = "working";
          pendingCalls.clear();
        }
        if (payload?.type === "task_complete") {
          lifecycle = payload.error ? "error" : "complete";
          pendingCalls.clear();
        }
        if (payload?.type === "turn_aborted") {
          lifecycle = "interrupted";
          pendingCalls.clear();
        }
        continue;
      }
      if (record.type !== "response_item" || !payload) continue;

      const callId = payload.call_id ?? payload.id;
      if (!callId) continue;
      if (payload.type === "function_call" || payload.type === "custom_tool_call") {
        pendingCalls.set(callId, {
          name: payload.name ?? "",
          payloadText: `${payload.arguments ?? ""}\n${payload.input ?? ""}`,
        });
      }
      if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
        pendingCalls.delete(callId);
      }
    } catch {
      // A tail read can begin in the middle of a JSONL record. Ignore that fragment.
    }
  }

  if (lifecycle !== "working") return lifecycle;

  for (const call of [...pendingCalls.values()].reverse()) {
    if (call.name === "request_user_input") return "waiting_input";
    if (call.name === "apply_patch") return "waiting_approval";
    if (
      (call.name === "exec" || call.name === "exec_command") &&
      call.payloadText.includes("require_escalated")
    ) {
      return "waiting_approval";
    }
  }
  return lifecycle;
}

export class CodexActivityMonitor {
  private readonly sessionsRoot: string;
  private readonly pathCache = new Map<string, string>();
  private readonly activityCache = new Map<string, CachedActivity>();

  constructor(codexDirectory = process.env.CODEX_HOME || path.join(os.homedir(), ".codex")) {
    this.sessionsRoot = path.join(codexDirectory, "sessions");
  }

  async apply(threads: CodexThread[]): Promise<CodexThread[]> {
    return Promise.all(threads.map((thread) => this.applyToThread(thread)));
  }

  private async applyToThread(thread: CodexThread): Promise<CodexThread> {
    const rolloutPath = await this.resolveRolloutPath(thread);
    if (!rolloutPath) return thread;
    const activity = await this.readActivity(rolloutPath);
    if (!activity || activity === "complete" || activity === "interrupted") return thread;
    if (activity === "error") {
      return {
        ...thread,
        status: { type: "systemError", activeFlags: [] },
      };
    }

    const turns = thread.turns.length
      ? thread.turns.map((turn, index) =>
          index === thread.turns.length - 1 ? { ...turn, status: "inProgress" as const } : turn,
        )
      : thread.turns;

    const inferredFlag = activity === "waiting_approval"
      ? "waitingOnApproval"
      : activity === "waiting_input"
        ? "waitingOnUserInput"
        : undefined;
    const activeFlags = [...(thread.status.activeFlags ?? [])];
    if (inferredFlag && !activeFlags.includes(inferredFlag)) activeFlags.push(inferredFlag);

    return {
      ...thread,
      status: { type: "active", activeFlags },
      turns,
    };
  }

  private async resolveRolloutPath(thread: CodexThread): Promise<string | undefined> {
    const cached = this.pathCache.get(thread.id);
    if (cached) return cached;

    if (thread.rolloutPath && this.isSafeRolloutPath(thread.rolloutPath)) {
      this.pathCache.set(thread.id, thread.rolloutPath);
      return thread.rolloutPath;
    }

    const created = new Date(thread.createdAt * 1000);
    for (const offset of [-1, 0, 1]) {
      const candidateDate = new Date(created);
      candidateDate.setDate(candidateDate.getDate() + offset);
      const directory = path.join(
        this.sessionsRoot,
        String(candidateDate.getFullYear()),
        String(candidateDate.getMonth() + 1).padStart(2, "0"),
        String(candidateDate.getDate()).padStart(2, "0"),
      );
      try {
        const name = (await readdir(directory)).find(
          (entry) => entry.endsWith(`${thread.id}.jsonl`) && entry.startsWith("rollout-"),
        );
        if (name) {
          const resolved = path.join(directory, name);
          this.pathCache.set(thread.id, resolved);
          return resolved;
        }
      } catch {
        // The date directory may not exist, especially for imported or remote threads.
      }
    }
    return undefined;
  }

  private isSafeRolloutPath(candidate: string): boolean {
    const resolved = path.resolve(candidate);
    return resolved.startsWith(`${path.resolve(this.sessionsRoot)}${path.sep}`) && resolved.endsWith(".jsonl");
  }

  private async readActivity(filePath: string): Promise<LifecycleActivity> {
    try {
      const fileStat = await stat(filePath);
      const cached = this.activityCache.get(filePath);
      if (cached?.size === fileStat.size && cached.modifiedAt === fileStat.mtimeMs) {
        return cached.activity;
      }

      const bytes = Math.min(fileStat.size, MAX_TAIL_BYTES);
      const buffer = Buffer.alloc(bytes);
      const handle = await open(filePath, "r");
      try {
        await handle.read(buffer, 0, bytes, fileStat.size - bytes);
      } finally {
        await handle.close();
      }
      const activity = lifecycleActivityFromText(buffer.toString("utf8"));
      this.activityCache.set(filePath, {
        size: fileStat.size,
        modifiedAt: fileStat.mtimeMs,
        activity,
      });
      return activity;
    } catch {
      return undefined;
    }
  }
}
