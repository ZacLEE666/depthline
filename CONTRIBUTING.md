# Contributing

Thank you for helping protect human depth.

## Before proposing a feature

Explain which unnecessary interruption, monitoring loop, or context-recovery cost the change removes. A feature that only increases agent throughput is probably outside Depthline's scope.

## Development

1. Install Node.js 20 or newer and a current Codex CLI.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://127.0.0.1:5173`.
5. Run `npm run check` before submitting a pull request.

Use `DEPTHLINE_DEMO=1 npm run dev` to work without reading local Codex threads.

## Pull requests

- Keep protocol-specific behavior inside the Codex adapter.
- Add tests for attention-routing changes.
- Update the product or privacy contract when behavior changes.
- Do not include real prompts, conversation exports, credentials, or private paths in fixtures.
