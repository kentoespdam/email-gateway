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

## 4. Frontend Standards (Bun + Vite + React + TypeScript)

> Applies to everything under `frontend/`.

### 4.1 Package Manager — Bun (MANDATORY)

*   **NEVER** use `npm`, `yarn`, or `pnpm` inside `frontend/`. Use **`bun`** exclusively.
*   Common commands:

    | Task | Command |
    |---|---|
    | Install dependencies | `bun install` |
    | Add a package | `bun add <package>` |
    | Add a dev dependency | `bun add -d <package>` |
    | Remove a package | `bun remove <package>` |
    | Run a script | `bun run <script>` |
    | Dev server | `bun run dev` |
    | Build | `bun run build` |
    | Preview build | `bun run preview` |
    | Lint | `bun run lint` |

*   **Lock file**: Always commit `bun.lock`. Never delete or manually edit it.
*   **`node_modules`**: Never commit. Ensure it is listed in `.gitignore`.

### 4.2 TypeScript Standards

*   **Strict mode** (`"strict": true`) is mandatory — no relaxation without explicit ADR.
*   No `any` types. Use `unknown` + type guards, or define proper interfaces/types.
*   Prefer `type` over `interface` for plain data shapes; use `interface` for extension/OOP patterns.
*   All React components must be typed with explicit prop interfaces/types.

### 4.3 React Standards

*   **React 19+**: Use functional components and hooks exclusively — no class components.
*   State: Use `useState` / `useReducer` for local state; `@tanstack/react-query` for server state.
*   Avoid prop-drilling deeper than 2 levels — lift state or use context/query.
*   File naming: `PascalCase` for components (e.g., `EmailList.tsx`), `camelCase` for hooks (e.g., `useEmailList.ts`).
*   One component per file. Co-locate styles and tests with the component.

### 4.4 Linting — oxlint (MANDATORY)

*   Linter: **`oxlint`** — do NOT install or use `eslint`.
*   Always run `bun run lint` before committing frontend changes.
*   Fix all lint errors; do NOT suppress warnings without a justified comment.
*   Lint config lives in `.oxlintrc.json` — modifications require team review.

### 4.5 File Size & Modularity (Frontend)

*   Same hard limits as backend: **150–250 LOC ideal**, **300 LOC max**.
*   Split large components into smaller sub-components.
*   Utility functions go in `src/utils/`, API call wrappers in `src/api/`.

### 4.6 Agent Rules for Frontend

*   When running any frontend command from within the agent terminal, prefix with `cd frontend &&` or run from inside the `frontend/` directory.
*   Use quiet/CI-friendly flags where available (e.g., `bun run build 2>&1 | tail -20`).
*   Do NOT run `bun install` unnecessarily — only when `package.json` changed.

---

## 5. Agent Operational Rules
...
*   **Terminal**: 
    *   Use quiet flags (`-q`, `head`, `grep`).
    *   Non-interactive shell commands required (e.g., `cp -f`, `rm -rf`).
    *   Always use `uv run <command>` for python-related tools.
    *   Always use `bun run <script>` for frontend-related tools (inside `frontend/`).

*   **Error Recovery Protocol**:
    1.  Attempt to fix the error independently (max **3 tries**).
    2.  If still failing after 3 attempts, **STOP guessing** — do NOT keep retrying blindly.
    3.  **Immediately research the internet** using `search_web` or `read_url_content` to find:
        *   Official documentation for the library/tool involved.
        *   Latest release notes or changelog (check for breaking changes).
        *   Best practices, known issues, and community solutions (GitHub issues, Stack Overflow, official blogs).
    4.  Apply the solution found from research, then resume.
    5.  **Report to user** what was found and what fix was applied.
    *   **Rationale**: Blind retrying wastes tokens and time. Fresh external sources prevent hallucinated fixes and ensure solutions match the actual library version in use.

---

## 6. Session Completion & Quality Gates
...
Work is **NOT** complete until pushed. Mandatory push sequence:

1.  Run backend quality gates: `uv run pytest`, linters.
2.  Run frontend quality gates: `bun run lint && bun run build` (inside `frontend/`).
3.  `git pull --rebase`
4.  `git push`
5.  `git status` (must show "up to date with origin")
