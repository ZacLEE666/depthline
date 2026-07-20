# Depthline

**Protect human depth in the age of parallel intelligence.**

Depthline is an open-source, local-first attention firewall for people working with multiple AI agents. The first adapter is built for Codex.

Instead of making you monitor every thread, Depthline asks a smaller question:

> Does a human need to think about this now?

It separates genuine decisions from progress noise, batches completed work for later review, and gives you a compact context capsule when you return.

[中文说明](README.zh-CN.md) · [Product contract](docs/PRODUCT.md) · [Architecture](docs/ARCHITECTURE.md) · [Privacy](docs/PRIVACY.md) · [Roadmap](docs/ROADMAP.md)

## Why

AI agents make execution asynchronous. A person can now start several substantial tasks in minutes, but each task becomes an unfinished cognitive scene: Is it blocked? Did it finish? What did I decide? What must I review?

Most agent tools optimize agent throughput. Depthline optimizes the scarce resource that remains: human attention.

## What V0.1 does

- Reads recent Codex threads through the local `codex app-server` protocol.
- Routes each thread into one of six human states:
  - needs your judgment;
  - approval requested;
  - needs recovery;
  - ready for review;
  - working quietly;
  - parked.
- Keeps active work silent unless Codex is waiting on a human.
- Generates a local context capsule with the goal, latest result, and next human move.
- Provides a 50-minute depth block, snooze, handled state, and a link back to the Codex workspace.
- Supports Chinese and English, follows the browser language by default, and remembers the local choice.
- Persists attention metadata only. Raw prompts and responses stay in process memory.

## Quick start

Requirements:

- Node.js 20 or newer;
- a current Codex CLI available as `codex`.

```bash
git clone https://github.com/ZacLEE666/depthline.git
cd depthline
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

To explore without reading local Codex threads:

```bash
DEPTHLINE_DEMO=1 npm run dev
```

For a production-style local build:

```bash
npm run build
npm start
```

Then open `http://127.0.0.1:4545`.

## Attention policy

| Codex signal | Depthline behavior |
| --- | --- |
| Waiting on user input | Interrupt: a human decision is blocking progress |
| Waiting on approval | Interrupt: an explicit approval is required in Codex |
| Failed turn or system error | Interrupt: recovery is required |
| Active without a wait signal | Silent: the agent is working |
| Observed turn changes from running to completed | Batch: review after the current focus block |
| Old or already handled thread | Park: no attention cost |

On first connection, existing completed threads are treated as historical and parked. Depthline persists the
last observed turn state, so only a later completion transition enters the review batch and handled results do
not reappear after restart. The policy is deterministic and covered by tests. Depthline does not ask another
model to decide when to interrupt you.

## Privacy and security

- The server binds to `127.0.0.1`, not the network.
- Depthline makes no outbound network requests.
- It never reads Codex credentials or private SQLite tables.
- It reads only lifecycle marker types from the tail of local Codex rollout files to detect running and completed work; message content is neither extracted nor persisted.
- It never automatically approves a Codex action.
- It stores only focus, snooze, handled, and thread identifier metadata in `~/.depthline/state.json`.
- Browser assets are bundled; there are no remote fonts, analytics, or tracking pixels.

See [docs/PRIVACY.md](docs/PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Codex compatibility

Depthline uses the official local `codex app-server` JSONL protocol instead of reverse-engineering Codex's private state database. The app-server is currently marked **experimental** by Codex and may change. Protocol-specific code is isolated in `src/server/codex-client.ts`, and Depthline falls back to an explicit sample workspace if the adapter cannot connect.

V0.1 launches its own app-server process for thread metadata and watches lifecycle markers in local rollout tails for live `working` and `completed` transitions. The browser receives snapshots over a local Server-Sent Events stream, so task movement does not require a page refresh. Approval and user-input wait signals still depend on the Codex app-server protocol and may vary by Codex build; protocol-specific behavior remains isolated in the adapter.

## Architecture

```text
Codex app-server → Codex adapter → attention engine → local HTTP API → React UI
                                      ↓
                          attention metadata only
```

The provider-neutral attention engine is intentionally separate from the Codex adapter. Future adapters can map other agent runtimes into the same human states.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run check
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing product behavior.

## Project principle

Depthline is not an agent fleet dashboard. A dashboard can make monitoring easier while preserving the habit of monitoring.

Depthline succeeds when you look at it less.

## Status

V0.1 is an early open-source prototype. The immediate goal is to validate the attention model with people who run three or more agent tasks per day.

## License

[MIT](LICENSE)
