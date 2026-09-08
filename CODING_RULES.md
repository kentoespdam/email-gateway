# CODING_RULES.md

This document defines the mandatory standards and workflows for the `email-gateway` project. Compliance is required for all contributors (human and AI).

---

## 1. Mandatory Pre-coding Workflow

Before starting any task or code modification, you **MUST**:

1.  **Activate `/ponytail`**: Ensure the `/ponytail` skill is loaded and active.
2.  **Issue Tracking (Beads)**:
    *   Use `bd` for all task management.
    *   `bd ready` to find work.
    *   `bd show <id>` to view details.
    *   `bd update <id> --claim` to claim work.
    *   `bd close <id>` to complete work.
    *   **STRICT PROHIBITION**: No markdown TODO lists or `TODO.md` files.
3.  **GitNexus Intelligence**:
    *   Before ANY edit: Run `gitnexus_impact({target: "symbol", direction: "upstream"})` to assess blast radius.
    *   NEVER edit without checking potential impact.
    *   Use `gitnexus_query` to find execution flows and `gitnexus_context` for full symbol context.
    *   Before committing: Run `gitnexus_detect_changes()` to verify scope.

---

## 2. Token Optimization & File Sizing

To ensure model efficiency and context stability:

*   **File Size Guidelines**:
    *   **Ideal**: 150 - 250 Lines of Code (LOC).
    *   **Hard Limit**: 300 LOC.
    *   **Refactor/Split Required**: >400 LOC.
*   **Rational**: These limits preserve context window budget, improve cache stability, and maximize micro-diff (`replace_file_content`) accuracy.
*   **Splitting Patterns**:
    *   `FastAPI` routes: Split by resource.
    *   `Pydantic` models: Separate files for complex schemas.
    *   `Celery` tasks: Task-specific modules.
    *   Connection management: Dedicated utility modules.

---

## 3. Python & FastAPI Standards

*   **Python/Project Manager**: `uv`. Use `uv sync`, `uv run <tool>`, `uv add <package>`, etc.
*   **Python Version**: 3.11+
*   **Typing**: Strict adherence to `typing` (PEP 604, PEP 585).
*   **FastAPI**: Use `async`/`await` consistently.
*   **Pydantic**: Use V2 schemas.
*   **Celery**:
    *   Must ensure idempotency in tasks.
    *   Use exponential backoff for retries.
    *   Implement SMTP connection pooling.
*   **Security**: Validate all API keys; ensure proper secret management (use environment variables/Vault).
*   **Testing**: `uv run pytest` with `async` test clients; strict SMTP mocking.

---

## 4. Agent Operational Rules
...
*   **Terminal**: 
    *   Use quiet flags (`-q`, `head`, `grep`).
    *   Non-interactive shell commands required (e.g., `cp -f`, `rm -rf`).
    *   Always use `uv run <command>` for python-related tools.

---

## 5. Session Completion & Quality Gates
...
Work is **NOT** complete until pushed. Mandatory push sequence:

1.  Run quality gates (`uv run pytest`, linters).
2.  `git pull --rebase`
3.  `git push`
4.  `git status` (must show "up to date with origin")
