# Task Completion Checklist

Use this checklist for every feature or bug fix.
Untuk urutan pengerjaan fitur/tugas implementasi, pantau dan ikuti [CLAIM_ORDER.md](CLAIM_ORDER.md).

- [x] **Issue Tracking**:
    - [x] `bd update <id> --claim`
- [x] **Research & Impact**:
    - [x] Skill `/ponytail` activated
    - [x] `gitnexus_impact` assessed (Blast radius analyzed)
- [x] **Implementation**:
    - [x] Adhere to CODING_RULES.md (Typing, Async, Pydantic V2)
    - [x] File size limits respected (<300 LOC)
    - [x] Non-interactive shell commands used
    - [x] `uv` used for project/package management
- [x] **Verification**:
    - [x] Tests passed (`uv run pytest`)
    - [x] Linters passed
    - [x] `gitnexus_detect_changes` verified
- [x] **Completion**:
    - [x] UI Frontend modernization (dashboard, theme, drawer)
    - [x] `bd close <id>`
    - [x] `git pull --rebase`
    - [x] `git push`
    - [x] `git status` (Confirm: "up to date with origin")
