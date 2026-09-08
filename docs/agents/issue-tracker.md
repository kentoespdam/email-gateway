# Issue tracker: Beads (bd)

Issues and PRDs for this repo live in **bd (beads)**, a local issue tracker backed by Dolt. Use the `bd` CLI for all operations.

## Conventions

- **Find available work**: `bd ready` — lists issues that are unclaimed and have no unresolved blockers.
- **View an issue**: `bd show <id>` — displays full issue details including description, status, and dependencies.
- **Claim work**: `bd update <id> --claim` — atomically claims an issue so no other agent picks it up.
- **Update an issue**: `bd update <id> --status <status>` — change status (e.g. `in_progress`, `blocked`).
- **Complete work**: `bd close <id>` — marks an issue as done.
- **Push to remote**: `bd dolt push` — pushes beads data to the Dolt remote. MANDATORY before ending a session.
- **Full reference**: `bd prime` — prints detailed command reference and session close protocol.

## Triage state

Record triage state using the labels defined in `triage-labels.md`. Apply them with `bd update <id> --label <label>` or equivalent bd command.

## When a skill says "publish to the issue tracker"

Create a new bd issue. Use `bd` CLI to create it with appropriate title, description, and labels.

## When a skill says "fetch the relevant ticket"

Run `bd show <id>` to retrieve the issue details.
