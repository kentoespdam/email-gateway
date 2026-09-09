# FE Dashboard — Issue Checklist & Claim Order

Implementasi Dashboard Admin (key management + log monitoring).
Urutan claim berdasarkan dependency antar issue.

---

## Group 1 — DB Schema (claim pertama, tidak ada dependency)

- [x] **BE-1** `feat: add AdminUser model + alembic migration`
  - Tabel `admin_users`: `id (UUID PK)`, `username (unique)`, `hashed_password`, `created_at`
  - Library: `passlib[bcrypt]`

- [x] **BE-2** `feat: add AdminSession model + alembic migration`
  - Tabel `admin_sessions`: `id (UUID PK)`, `user_id (FK admin_users)`, `token (UUID unique)`, `last_seen_at`, `expires_at`
  - Sliding window 24 jam: `expires_at = last_seen_at + 24h`

- [x] **BE-3** `feat: add expires_at to ApiKey + alembic migration`
  - Kolom nullable: `expires_at (DateTime, timezone=True, nullable)`

---

## Group 2 — Backend Config (claim setelah Group 1 selesai)

- [x] **BE-4** `feat: add CORSMiddleware + ALLOWED_ORIGINS env var`
  - `allow_origins` dari env var `ALLOWED_ORIGINS` (comma-separated)
  - `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`

- [x] **BE-5** `feat: admin bootstrap on startup via env var`
  - Baca `ADMIN_USERNAME` + `ADMIN_PASSWORD` dari env
  - Jika tabel `admin_users` kosong, buat user pertama otomatis saat startup
  - Skip jika sudah ada user

- [x] **BE-6** `fix: validate ApiKey expires_at in security.py`
  - Tambah cek `expires_at is None or expires_at > now()` di `_lookup_api_key`

---

## Group 3 — Auth API (claim setelah BE-1, BE-2, BE-5)

- [x] **BE-7** `feat: admin auth endpoints`
  - `POST /admin/auth/login` — terima `{username, password}`, return cookie `session_token` (HttpOnly, SameSite=Lax)
  - `POST /admin/auth/logout` — hapus baris `admin_sessions`, clear cookie
  - `GET /admin/auth/me` — return info AdminUser dari session aktif
  - Update `last_seen_at` + perpanjang `expires_at` di setiap request terautentikasi

---

## Group 4 — Admin API (claim setelah BE-7)

- [ ] **BE-8** `feat: user management endpoints`
  - `GET /admin/users` — list semua AdminUser
  - `POST /admin/users` — buat user baru (min password 8 char)
  - `DELETE /admin/users/{id}` — hapus user (tidak bisa hapus diri sendiri)
  - `PUT /admin/users/{id}/password` — reset password

- [ ] **BE-9** `feat: API Key management endpoints`
  - `GET /admin/api-keys` — list semua ApiKey (id, client_name, is_active, created_at, expires_at)
  - `POST /admin/api-keys` — buat key baru (generate `key_token` random, return sekali saja)
  - `PATCH /admin/api-keys/{id}` — update `is_active`, `client_name`, `allowed_from_addresses`, `expires_at`
  - `DELETE /admin/api-keys/{id}` — hapus key

- [ ] **BE-10** `feat: mail transaction list endpoint`
  - `GET /admin/transactions` — list Mail Transaction dengan filter:
    - `status` (queued/sent/failed)
    - `from_date`, `to_date` (created_at range)
    - `api_key_id` (filter per client)
    - `subject` (ILIKE search)
  - Pagination: `?page=1&page_size=50`, response include `total_count`

---

## Group 5 — Frontend Scaffold (claim paralel dengan Group 1)

- [ ] **FE-1** `feat: scaffold frontend project`
  - `bun create vite frontend --template react-ts`
  - Install: `antd`, `@tanstack/react-query`, `react-router-dom`, `axios`
  - Setup: Ant Design theme, React Query Provider, Router
  - Tambah `frontend/Dockerfile` (multi-stage: build → nginx serve)

---

## Group 6 — FE Pages (claim setelah BE-7..BE-10 dan FE-1)

- [ ] **FE-2** `feat: login page + auth flow`
  - Form login (username + password) via Ant Design `Form`
  - Call `POST /admin/auth/login`, store session via cookie (browser otomatis)
  - Protected route: redirect ke `/login` jika tidak ada session (`GET /admin/auth/me` gagal)

- [ ] **FE-3** `feat: API Key management page`
  - Table: id (masked), client_name, allowed_from_addresses, is_active, expires_at, created_at
  - Aksi: Create (modal form), Enable/Disable toggle, Delete (confirm dialog), Edit
  - Tampilkan `key_token` sekali saja saat create (copy-to-clipboard)

- [ ] **FE-4** `feat: user management page`
  - Table: username, created_at
  - Aksi: Create user (modal), Reset password, Delete (tidak bisa hapus diri sendiri)

- [ ] **FE-5** `feat: log monitoring page`
  - Table: task_id, from_address, to_addresses, subject, status badge, retry_count, created_at, delivered_at
  - Filter bar: status dropdown, date range picker, API Key select, subject search input
  - Auto-refresh: React Query `refetchInterval: 30000`
  - Pagination: Ant Design Table pagination

---

## Group 7 — Docker & Deploy (claim setelah semua selesai)

- [ ] **INFRA-1** `feat: update docker-compose.yml for frontend`
  - Tambah service `frontend`: build dari `./frontend/Dockerfile`, port `3000:80`
  - Tambah env var baru ke service `api`: `ALLOWED_ORIGINS`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`

---

## Dependency Tree

```
BE-1 (AdminUser model)
BE-2 (AdminSession model)  ──┐
BE-3 (ApiKey expires_at)     │
                             ▼
BE-4 (CORS)            BE-5 (Bootstrap) ── BE-6 (expires_at check)
                             │
                             ▼
                        BE-7 (Auth API)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         BE-8 (Users)  BE-9 (ApiKeys)  BE-10 (Transactions)
              │              │              │
              └──────────────┼──────────────┘
FE-1 (Scaffold) ────────────►│
                             ▼
                   FE-2 (Login) → FE-3/FE-4/FE-5 (Pages)
                                           │
                                           ▼
                                      INFRA-1 (docker-compose)
```
