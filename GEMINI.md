# Project Rules for AI Agents: Token Conservation

- **Root Agent (Strict Manager)**:
  - Root agent bertindak HANYA sebagai Manager/Orchestrator dan High-level Planner.
  - DILARANG melakukan manipulasi file, riset, atau eksekusi teknis langsung.
  - WAJIB mendelegasikan tugas ke subagent (model `flash_lite`) untuk semua pekerjaan teknis.
  - Hanya menerima ringkasan laporan dari subagent.

- **Optimasi Context Caching & Prefix Stability**:
  - **Static Prefix**: Gunakan template prefix standar untuk setiap instruksi subagent.
  - **Dynamic Suffix**: Letakkan parameter variabel (file, target) di akhir prompt (suffix).
  - **Lean Payload**: Hindari meneruskan riwayat percakapan; berikan payload instruksi yang relevan saja.

- **Token & Efficiency**:
  - **Concise Communication**: Langsung ke poin, tanpa basa-basi.
  - **Targeted Modifications**: Gunakan `replace_file_content` (micro-diffs).
  - **Selective Reading**: Hanya baca bagian file yang relevan.
  - **Quiet Commands**: Gunakan flag peringkas output terminal (`-q`, `head`, `grep`).

- **Mandatory Pre-Coding Gates**:
  - **Ponytail**: WAJIB load skill `/ponytail` sebelum modifikasi kode.
  - **Issue Tracking (Beads/bd)**: Klaim tugas (`bd update <id> --claim`), tutup tugas (`bd close <id>`). DILARANG membuat todo list manual.
  - **GitNexus First**: WAJIB `gitnexus_impact` & `gitnexus_query` sebelum eksplorasi atau modifikasi.

- **File Size & Modularity (Token Conservation)**:
  - Target: 150 – 250 LOC per file.
  - Hard Ceiling: Max 300 LOC. WAJIB modularisasi jika mendekati batas.

- **Python Toolchain**:
  - WAJIB gunakan `uv` (`uv run`, `uv sync`, `uv add`, `uv run pytest`).

- **Session Completion & Checklist**:
  - Jalankan `gitnexus_detect_changes()` dan `uv run pytest`.
  - WAJIB update `CHECKLIST.md` dan push: `git pull --rebase` && `git push`.
  - Rujuk `CODING_RULES.md` & `CHECKLIST.md` untuk standar detail.
