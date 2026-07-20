# Architecture

## Design choice

Depthline is a local web application with a small Node.js control process. The browser renders the attention model; the Node process owns the Codex protocol adapter and local preferences.

```text
Codex CLI state
      │
      │ JSONL over stdio
      ▼
codex app-server (experimental)
      │
      ▼
Codex adapter ──► attention engine ──► loopback HTTP API ──► React interface
                         │
                         ▼
              ~/.depthline/state.json
              attention metadata only
```

## Trust boundaries

- The HTTP server binds only to `127.0.0.1`.
- Mutation requests reject non-loopback browser origins.
- The Codex child process inherits the user's existing Codex authentication; Depthline never reads or stores credentials.
- Thread content may be read into process memory to build a context capsule. It is not written to Depthline storage.
- `Open in Codex` accepts only a thread ID already returned by Codex, then uses that thread's known working directory.

## Adapter boundary

`src/server/codex-client.ts` is the only module allowed to understand Codex JSON-RPC details. It performs:

1. `initialize` with experimental API capability.
2. `thread/list` for recent non-archived work.
3. `thread/read` for a bounded set of recent threads.
4. Event-driven refresh on thread status, name, and turn completion notifications.

The rest of Depthline consumes a small internal `CodexThread` type. If the protocol changes, replace the adapter rather than rewriting the product.

## Failure and degradation

| Failure | Behavior |
| --- | --- |
| Codex binary missing | Explicit sample workspace with warning |
| App-server protocol failure | Degraded sample workspace; no private DB fallback |
| Thread read timeout | Preserve list metadata and continue |
| Preference file missing | Start with empty state |
| Corrupt or unexpected state file | Return an error rather than guessing |
| Browser opened from another origin | Reject state-changing request |

## Known V0.1 integration limit

Depthline currently launches a dedicated app-server process. Recent threads and completed turns are shared through Codex state, while active/waiting status from another Codex app process may not be reflected in every Codex build. The adapter therefore treats the protocol as experimental and never substitutes private database inspection. The intended next step is a shared Codex event-stream or daemon connection when that surface is available.

## Future adapters

The attention engine is deliberately provider-neutral. Claude Code, GitHub Agent HQ, Gemini, or MCP notification adapters can later map their events into the same internal states without changing the interface contract.
