# Depthline agent guide

## Product invariant

Depthline exists to protect human depth, not maximize the number of active agents. New features must reduce unnecessary monitoring, interruption, or context-recovery cost.

## Safety and privacy

- Keep the server bound to `127.0.0.1` by default.
- Never persist raw Codex prompts, responses, tool output, file contents, credentials, or authentication material.
- Do not read Codex's private SQLite schema. Use the documented app-server protocol through the adapter.
- Treat `codex app-server` as experimental. Keep protocol-specific logic inside `src/server/codex-client.ts`.
- Never auto-approve Codex actions. Depthline may surface an approval request, but the user decides in Codex.

## Verification

Run `npm run check` before proposing a release. A change to attention routing requires a focused unit test in `tests/attention-engine.test.ts`.

## Interface principles

- One primary human focus, not a wall of equal-priority cards.
- Blocking decisions may interrupt; completed work is batched; active work is quiet.
- Show the minimum context needed for a decision.
- Maintain keyboard focus, readable contrast, responsive behavior, and reduced-motion support.
