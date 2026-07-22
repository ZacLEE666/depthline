import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";
import { resolveCodexBinary } from "./codex-binary.js";
import type {
  CodexThread,
  CodexThreadListResponse,
  CodexThreadReadResponse,
} from "./codex-types.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface RpcMessage {
  id?: number | string;
  method?: string;
  result?: unknown;
  error?: { message?: string; code?: number };
  params?: unknown;
}

export class CodexAppServerClient extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams;
  private pending = new Map<number | string, PendingRequest>();
  private requestId = 0;
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.close();
    const binary = await resolveCodexBinary();
    this.child = spawn(binary, ["app-server", "--listen", "stdio://"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const lines = readline.createInterface({ input: this.child.stdout });
    lines.on("line", (line) => this.handleLine(line));
    this.child.stderr.on("data", (chunk) => this.emit("diagnostic", String(chunk)));
    this.child.on("error", (error) => this.failAll(error));
    this.child.on("exit", (code, signal) => {
      this.started = false;
      this.failAll(new Error(`Codex app-server exited (${code ?? signal ?? "unknown"}).`));
      this.emit("disconnect");
    });

    try {
      await this.request("initialize", {
        clientInfo: { name: "depthline", title: "守深 · Depthline", version: "0.1.0" },
        capabilities: { experimentalApi: true },
      });
      this.notify("initialized", {});
      this.started = true;
    } catch (error) {
      this.close();
      throw error;
    }
  }

  async listThreads(limit = 40): Promise<CodexThread[]> {
    const result = (await this.request("thread/list", {
      limit,
      sortKey: "recency_at",
      sortDirection: "desc",
      archived: false,
      useStateDbOnly: false,
    })) as CodexThreadListResponse;

    const base = result.data ?? [];
    const enriched = await Promise.all(
      base.map(async (thread) => {
        try {
          const response = (await this.request(
            "thread/read",
            { threadId: thread.id, includeTurns: true },
            12_000,
          )) as CodexThreadReadResponse;
          return response.thread;
        } catch {
          return thread;
        }
      }),
    );
    const enrichedById = new Map(enriched.map((thread) => [thread.id, thread]));
    return base.map((thread) => enrichedById.get(thread.id) ?? thread);
  }

  close(): void {
    this.child?.kill("SIGTERM");
    this.child = undefined;
    this.started = false;
  }

  private request(method: string, params: unknown, timeoutMs = 8_000): Promise<unknown> {
    if (!this.child?.stdin.writable) {
      return Promise.reject(new Error("Codex app-server is not connected."));
    }
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.write({ id, method, params });
    });
  }

  private notify(method: string, params: unknown): void {
    this.write({ method, params });
  }

  private write(message: RpcMessage): void {
    this.child?.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      this.emit("diagnostic", `Ignored non-JSON app-server output: ${line}`);
      return;
    }

    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "Codex app-server request failed."));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      this.emit("notification", message);
      if (
        message.method === "thread/status/changed" ||
        message.method === "turn/completed" ||
        message.method === "thread/name/updated"
      ) {
        this.emit("attention-change", message);
      }
    }
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
