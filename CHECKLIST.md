# Task Completion Checklist

Use this checklist for every feature or bug fix.
Untuk urutan pengerjaan fitur/tugas implementasi, pantau dan ikuti [CLAIM_ORDER.md](CLAIM_ORDER.md).

- [ ] **Issue Tracking**:
    - [ ] `bd update <id> --claim`
- [ ] **Research & Impact**:
    - [ ] Skill `/ponytail` activated
    - [ ] `gitnexus_impact` assessed (Blast radius analyzed)
- [ ] **Implementation**:
    - [ ] Adhere to CODING_RULES.md (Typing, Async, Pydantic V2)
    - [ ] File size limits respected (<300 LOC)
    - [ ] Non-interactive shell commands used
    - [ ] `uv` used for project/package management
- [ ] **Verification**:
    - [ ] Tests passed (`uv run pytest`)
    - [ ] Linters passed
    - [ ] `gitnexus_detect_changes` verified
- [ ] **Completion**:
    - [ ] `bd close <id>`
    - [ ] `git pull --rebase`
    - [ ] `git push`
    - [ ] `git status` (Confirm: "up to date with origin")
