# Security policy

## Supported versions

Depthline is pre-1.0. Security fixes are applied to the latest release on the default branch.

## Reporting

Please use GitHub's private vulnerability reporting for the repository. Do not open a public issue for vulnerabilities that could expose Codex conversations, local files, credentials, or command execution.

Include the affected version, operating system, reproduction steps, and impact. Remove tokens, prompts, file contents, usernames, and private paths.

## Security invariants

- Loopback binding by default.
- No raw conversation persistence.
- No automatic approval decisions.
- No direct access to Codex authentication stores or private SQLite schemas.
- State-changing browser requests accept loopback origins only.
