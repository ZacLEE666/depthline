# Product contract

## Vision

In the age of parallel intelligence, humans should still be able to think deeply.

Depthline is an open-source attention firewall between people and AI agents. It turns raw agent activity into a small set of human states, suppresses progress noise, and restores context only when the person chooses to return.

## Target user

The first user runs at least three Codex tasks in parallel and repeatedly checks threads to discover whether an agent is still working, blocked, failed, or ready for review.

## Job to be done

When several agents are working asynchronously, help me know exactly when my judgment is required and restore the smallest useful context, so I can keep one human thought alive instead of continuously monitoring machines.

## V0.1 scope

1. Connect locally to Codex through `codex app-server`.
2. Normalize threads into `needs input`, `needs approval`, `error`, `ready for review`, `working quietly`, `delayed`, and `parked`.
3. Present one decision inbox, one quiet lane, and one batched review lane.
4. Generate a deterministic context capsule from data already returned by Codex.
5. Allow a 50-minute focus block, snoozing, marking handled, and opening the task's workspace in Codex.
6. Persist only user attention metadata.

## Explicit non-goals

- Replacing Codex, an IDE, GitHub, or a task manager.
- Running or orchestrating arbitrary third-party agents in V0.1.
- Automatically approving commands, file changes, purchases, or permissions.
- Cloud synchronization, accounts, teams, billing, or remote access.
- Persisting or analyzing private conversation content outside the local process.

## Attention policy

| Signal | Depthline state | Interruption policy |
| --- | --- | --- |
| `waitingOnUserInput` | Needs your judgment | Blocking |
| `waitingOnApproval` | Approval requested | Blocking |
| System or latest-turn failure | Needs recovery | Blocking |
| Active without a wait flag | Working quietly | Silent |
| Recent completed turn | Ready for review | Batch |
| Old, handled, or unloaded thread | Parked | Silent |

## Success measures

- A user identifies the next required decision in under 10 seconds.
- Active work without a human dependency produces no attention demand.
- A completed thread can be re-entered without opening its full transcript first.
- No raw Codex content is written to Depthline storage.
- The app remains usable when Codex is missing through an explicit sample mode.

## Key assumptions to validate

- Codex thread states are sufficiently accurate to route attention.
- Users trust an inbox that intentionally hides progress logs.
- A deterministic context capsule is useful without a second summarization model.
- Users value avoided interruptions enough to keep Depthline open during agent-heavy work.
