import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSnapshot, observeThreadTransitions } from "./attention-engine.js";
import { CodexAppServerClient } from "./codex-client.js";
import { openCodexThread } from "./codex-launcher.js";
import type { CodexThread } from "./codex-types.js";
import { demoThreads } from "./demo.js";
import { LocalStateStore } from "./store.js";
import type { DepthlineSnapshot, PersistedState } from "../shared/types.js";

const PORT = Number(process.env.DEPTHLINE_PORT || 4545);
const HOST = "127.0.0.1";
const POLL_MS = 4_000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "../../client");
const store = new LocalStateStore();
const codex = new CodexAppServerClient();

let threads: CodexThread[] = [];
let persistedState: PersistedState = await store.read();
let connection: DepthlineSnapshot["connection"] = "connecting";
const forcedDemo = process.env.DEPTHLINE_DEMO === "1";
let mode: DepthlineSnapshot["mode"] = forcedDemo ? "demo" : "codex";
let warning: string | undefined;
let refreshPromise: Promise<void> | undefined;

function snapshot(): DepthlineSnapshot {
  return buildSnapshot(threads, persistedState, { mode, connection, warning });
}

async function refresh(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    if (forcedDemo) {
      threads = demoThreads();
      connection = "connected";
      return;
    }
    try {
      await codex.start();
      const nextThreads = await codex.listThreads();
      await updateState((state) => {
        observeThreadTransitions(nextThreads, state);
      });
      threads = nextThreads;
      mode = "codex";
      connection = "connected";
      warning = undefined;
    } catch (error) {
      mode = "demo";
      connection = "degraded";
      threads = demoThreads();
      warning = `Codex is unavailable, so Depthline is showing sample work. ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  })().finally(() => {
    refreshPromise = undefined;
  });
  return refreshPromise;
}

codex.on("attention-change", () => void refresh());
codex.on("disconnect", () => {
  connection = "degraded";
});

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function bodyJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function validOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const allowedHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    const allowedPort = parsed.port === String(PORT) || origin === process.env.DEPTHLINE_DEV_ORIGIN;
    return parsed.protocol === "http:" && allowedHost && allowedPort;
  } catch {
    return false;
  }
}

async function updateState(mutator: (state: PersistedState) => void): Promise<void> {
  persistedState = await store.update(mutator);
}

async function handleApi(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith("/api/")) return false;

  if (request.method === "GET" && url.pathname === "/api/snapshot") {
    json(response, 200, snapshot());
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    json(response, 200, { ok: true, mode, connection, codexThreads: threads.length });
    return true;
  }
  if (request.method !== "GET" && !validOrigin(request)) {
    json(response, 403, { error: "Origin rejected." });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/focus") {
    const body = await bodyJson(request);
    const minutes = Math.min(180, Math.max(5, Number(body.minutes) || 50));
    const threadId = typeof body.threadId === "string" ? body.threadId : undefined;
    await updateState((state) => {
      state.focus = { until: new Date(Date.now() + minutes * 60_000).toISOString(), threadId };
    });
    json(response, 200, snapshot());
    return true;
  }
  if (request.method === "DELETE" && url.pathname === "/api/focus") {
    await updateState((state) => {
      delete state.focus;
    });
    json(response, 200, snapshot());
    return true;
  }

  const actionMatch = url.pathname.match(/^\/api\/items\/([^/]+)\/(snooze|handled|open)$/);
  if (request.method === "POST" && actionMatch) {
    const threadId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) {
      json(response, 404, { error: "Thread not found." });
      return true;
    }
    if (action === "snooze") {
      const body = await bodyJson(request);
      const minutes = Math.min(1_440, Math.max(5, Number(body.minutes) || 30));
      await updateState((state) => {
        state.threadPreferences[threadId] = {
          ...state.threadPreferences[threadId],
          snoozedUntil: new Date(Date.now() + minutes * 60_000).toISOString(),
        };
      });
    } else if (action === "handled") {
      await updateState((state) => {
        const completedTurnId = thread.turns.at(-1)?.status === "completed"
          ? thread.turns.at(-1)?.id
          : undefined;
        state.threadPreferences[threadId] = {
          ...state.threadPreferences[threadId],
          handledAt: new Date().toISOString(),
          snoozedUntil: undefined,
          pendingReviewTurnId:
            state.threadPreferences[threadId]?.pendingReviewTurnId === completedTurnId
              ? undefined
              : state.threadPreferences[threadId]?.pendingReviewTurnId,
        };
      });
    } else if (action === "open") {
      if (mode === "demo") {
        json(response, 409, { error: "Opening Codex is disabled in demo mode." });
        return true;
      }
      try {
        await openCodexThread(thread.id);
        json(response, 200, { ok: true, opened: "thread" });
      } catch (error) {
        json(response, 502, {
          error: `Could not open Codex. ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      return true;
    }
    json(response, 200, snapshot());
    return true;
  }

  json(response, 404, { error: "Not found." });
  return true;
}

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function serveClient(response: ServerResponse, pathname: string): Promise<void> {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  let filePath = path.resolve(clientRoot, requested);
  if (!filePath.startsWith(`${clientRoot}${path.sep}`) && filePath !== clientRoot) {
    json(response, 400, { error: "Invalid path." });
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    filePath = path.join(clientRoot, "index.html");
  }
  response.writeHead(200, {
    "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'",
  });
  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if (!response.headersSent) json(response, 404, { error: "Asset not found." });
    else response.destroy(error);
  });
  stream.pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (await handleApi(request, response, url)) return;
    await serveClient(response, url.pathname);
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
});

await refresh();
const timer = setInterval(() => void refresh(), POLL_MS);
timer.unref();

server.listen(PORT, HOST, () => {
  console.log(`Depthline is listening on http://${HOST}:${PORT}`);
});

function shutdown(): void {
  clearInterval(timer);
  codex.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
