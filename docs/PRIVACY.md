# Privacy model

Depthline is local-first by construction.

## What it reads

- Codex thread identifiers, names, previews, status, timestamps, and a bounded set of recent turns returned by `codex app-server`.
- The working directory associated with a Codex thread so the user can reopen that workspace.

## What it stores

Depthline stores only:

- focus-session end time and selected thread ID;
- snooze timestamps;
- handled timestamps;
- future attention preferences that follow the same metadata-only rule.

By default this lives in `~/.depthline/state.json` with user-only file permissions. Set `DEPTHLINE_DATA_DIR` to choose another location.

## What it does not store

- prompts or responses;
- reasoning, terminal output, diffs, file contents, screenshots, or tool results;
- OpenAI or GitHub credentials;
- API keys, access tokens, cookies, or approval decisions;
- analytics or telemetry.

## Network behavior

Depthline itself makes no outbound network requests. Codex continues to follow the user's own configuration and policies. Browser assets are bundled with the application.

## Reporting a privacy issue

Do not open a public issue containing private logs or conversation content. Follow `SECURITY.md` and share only the minimum reproduction data.
