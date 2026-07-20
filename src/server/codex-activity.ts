import { open, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CodexThread } from "./codex-types.js";

const MAX_TAIL_BYTES = 512 * 1024;

type LifecycleActivity = "working" | "complete" | "interrupted" | undefined;

interface RolloutRecord {
  type?: string;
  payload?: { type?: string };
}

interface CachedActivity {
  size: number;
  modifiedAt: number;
  activity: LifecycleActivity;
}

export function lifecycleActivityFromText(text: string): LifecycleActivity {
  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      const record = JSON.parse(line) as RolloutRecord;
      if (record.type !== "event_msg") continue;
      if (record.payload?.type === "task_started") return "working";
      if (record.payload?.type === "task_complete") return "complete";
      if (record.payload?.type === "turn_aborted") return "interrupted";
    } catch {
      // A tail read can begin in the middle of a JSONL record. Ignore that fragment.
    }
  }
  return undefined;
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
    if (activity !== "working") return thread;

    const turns = thread.turns.length
      ? thread.turns.map((turn, index) =>
          index === thread.turns.length - 1 ? { ...turn, status: "inProgress" as const } : turn,
        )
      : thread.turns;

    return {
      ...thread,
      status: { type: "active", activeFlags: thread.status.activeFlags ?? [] },
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
