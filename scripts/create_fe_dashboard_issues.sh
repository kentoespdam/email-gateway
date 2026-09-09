#!/usr/bin/env bash
set -e

echo "==> Mendaftarkan 16 Beads Issues untuk FE Dashboard (Key Management & Log Monitoring)..."

# ============================================================
# GROUP 1 — DB Schema (no dependencies)
# ============================================================

BE1=$(bd create "Add AdminUser model and Alembic migration" \
  -t feature -p 2 -l ready-for-agent \
  -d "Buat model AdminUser (SQLAlchemy) dan migrasi Alembic untuk tabel admin_users.

Skema:
- id: UUID PK
- username: String(255), unique, indexed
- hashed_password: String(255)
- created_at: DateTime timezone

Gunakan passlib[bcrypt] untuk password hashing. Tambahkan uv add passlib[bcrypt]. Ini adalah fondasi untuk sistem auth Dashboard admin." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-1: $BE1"

BE2=$(bd create "Add AdminSession model and Alembic migration" \
  -t feature -p 2 -l ready-for-agent \
  -d "Buat model AdminSession (SQLAlchemy) dan migrasi Alembic untuk tabel admin_sessions.

Skema:
- id: UUID PK
- user_id: UUID FK -> admin_users.id
- token: UUID, unique, indexed
- last_seen_at: DateTime timezone
- expires_at: DateTime timezone

Sliding window 24 jam: expires_at = last_seen_at + timedelta(hours=24). Session invalid jika expires_at < now()." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-2: $BE2"

BE3=$(bd create "Add nullable expires_at field to ApiKey + Alembic migration" \
  -t feature -p 2 -l ready-for-agent \
  -d "Tambah kolom expires_at ke model ApiKey dan buat Alembic migration.

Skema tambahan:
- expires_at: DateTime(timezone=True), nullable=True, default=None

Semantics: NULL = tidak pernah expired. Non-null = expired setelah tanggal tersebut. Dipakai untuk key rotation otomatis dari Dashboard." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-3: $BE3"

# ============================================================
# GROUP 2 — Backend Config
# ============================================================

BE4=$(bd create "Add CORSMiddleware with ALLOWED_ORIGINS env var" \
  -t feature -p 2 -l ready-for-agent \
  -d "Tambah fastapi.middleware.cors.CORSMiddleware ke FastAPI app.

Konfigurasi:
- allow_origins: dari env var ALLOWED_ORIGINS (comma-separated). Default: http://localhost:5173
- allow_credentials: True
- allow_methods: [\"*\"]
- allow_headers: [\"*\"]

CATATAN KRITIS: wildcard allow_origins='*' TIDAK kompatibel dengan allow_credentials=True di browser. Selalu gunakan explicit origin list." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-4: $BE4"

BE5=$(bd create "Admin bootstrap on startup via env var" \
  -t feature -p 2 -l ready-for-agent \
  -d "Saat aplikasi startup, baca env var ADMIN_USERNAME dan ADMIN_PASSWORD.

Logika:
1. Jika tabel admin_users KOSONG: buat AdminUser pertama dengan password ter-hash (bcrypt)
2. Jika sudah ada user: skip tanpa error
3. Implementasi di FastAPI lifespan context manager (bukan @app.on_event deprecated)

Tambah ADMIN_USERNAME dan ADMIN_PASSWORD ke .env.example dan config.py." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-5: $BE5"

BE6=$(bd create "Validate ApiKey expires_at in security.py" \
  -t task -p 2 -l ready-for-agent \
  -d "Update fungsi _lookup_api_key di app/security.py untuk memeriksa expires_at.

Logika tambahan di WHERE clause:
  AND (expires_at IS NULL OR expires_at > now())

Key expired harus ditolak dengan HTTP 401 (pesan: 'API key has expired') sama seperti inactive key. Tambah test case untuk key expired." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-6: $BE6"

# ============================================================
# GROUP 3 — Auth API
# ============================================================

BE7=$(bd create "Admin auth endpoints: login, logout, me" \
  -t feature -p 2 -l ready-for-agent \
  -d "Buat router /admin/auth dengan 3 endpoint. Semua endpoint dalam file app/routers/admin_auth.py.

Endpoint:
1. POST /admin/auth/login
   - Body: {username, password}
   - Validasi: cari user di admin_users, verifikasi bcrypt hash
   - Sukses: buat AdminSession (UUID token), set HttpOnly cookie 'session_token' SameSite=Lax
   - Gagal: HTTP 401

2. POST /admin/auth/logout
   - Hapus baris AdminSession dari DB
   - Clear cookie session_token

3. GET /admin/auth/me
   - Baca cookie session_token
   - Lookup AdminSession, cek expires_at
   - Update last_seen_at + perpanjang expires_at += 24h (sliding window)
   - Return: {id, username, created_at}
   - Gagal: HTTP 401

Buat dependency require_admin_session() untuk dipakai di semua admin endpoint." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-7: $BE7"

# ============================================================
# GROUP 4 — Admin API
# ============================================================

BE8=$(bd create "User management endpoints for Dashboard" \
  -t feature -p 2 -l ready-for-agent \
  -d "Buat router /admin/users dalam file app/routers/admin_users.py. Semua endpoint require dependency require_admin_session().

Endpoint:
- GET /admin/users: list semua AdminUser (id, username, created_at)
- POST /admin/users: buat user baru. Body: {username, password}. Validasi: password min 8 char, username unique. Hash password dengan bcrypt.
- DELETE /admin/users/{id}: hapus user. TOLAK dengan HTTP 400 jika id == current session user (tidak bisa hapus diri sendiri).
- PUT /admin/users/{id}/password: reset password. Body: {new_password}. Validasi min 8 char. Hash ulang." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-8: $BE8"

BE9=$(bd create "API Key management endpoints for Dashboard" \
  -t feature -p 2 -l ready-for-agent \
  -d "Buat router /admin/api-keys dalam file app/routers/admin_api_keys.py. Semua endpoint require dependency require_admin_session().

Endpoint:
- GET /admin/api-keys: list semua ApiKey. Response: id, client_name, is_active, created_at, expires_at. key_token TIDAK dikembalikan di list.
- POST /admin/api-keys: buat key baru. Body: {client_name, allowed_from_addresses, expires_at?}. Generate key_token menggunakan secrets.token_urlsafe(32). Return key_token HANYA SEKALI di response create — tidak bisa diambil lagi.
- PATCH /admin/api-keys/{id}: update fields: is_active, client_name, allowed_from_addresses, expires_at.
- DELETE /admin/api-keys/{id}: hapus key." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-9: $BE9"

BE10=$(bd create "Mail transaction list endpoint with filters and pagination" \
  -t feature -p 2 -l ready-for-agent \
  -d "Buat endpoint GET /admin/transactions dalam file app/routers/admin_transactions.py. Require dependency require_admin_session().

Query params (semua optional):
- status: str (queued/sent/failed)
- from_date: date (filter created_at >=)
- to_date: date (filter created_at <=)
- api_key_id: UUID (filter per client_id)
- subject: str (ILIKE %subject% search)
- page: int (default 1)
- page_size: int (default 50, max 100)

Response:
- items: list MailTransaction
- total_count: int (total rows tanpa pagination)
- page: int
- page_size: int

Query: SQLAlchemy dengan COUNT subquery atau func.count() window." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "BE-10: $BE10"

# ============================================================
# GROUP 5 — Frontend Scaffold
# ============================================================

FE1=$(bd create "Scaffold React frontend project with Bun" \
  -t task -p 2 -l ready-for-agent \
  -d "Setup project FE di folder frontend/ (monorepo root).

Langkah:
1. bun create vite frontend --template react-ts
2. cd frontend && bun add antd @tanstack/react-query react-router-dom axios
3. bun add -d @types/node
4. Setup file utama:
   - src/main.tsx: ConfigProvider (Ant Design theme), QueryClientProvider, BrowserRouter
   - src/App.tsx: route structure placeholder
   - src/api/client.ts: axios instance dengan baseURL dari env VITE_API_URL, withCredentials: true
5. Buat frontend/Dockerfile: multi-stage (node/bun build -> nginx:alpine serve /usr/share/nginx/html)
6. Buat frontend/.env.example: VITE_API_URL=http://localhost:8000
7. Buat frontend/.dockerignore
8. Update root .gitignore untuk frontend/node_modules" \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "FE-1: $FE1"

# ============================================================
# GROUP 6 — FE Pages
# ============================================================

FE2=$(bd create "Login page and protected route auth flow" \
  -t feature -p 2 -l ready-for-agent \
  -d "Implementasi auth flow di FE. File: src/pages/LoginPage.tsx, src/components/ProtectedRoute.tsx, src/hooks/useAuth.ts.

LoginPage:
- Ant Design Form dengan field username + password
- Submit: POST /admin/auth/login (axios, withCredentials: true)
- Sukses: navigate ke / (browser otomatis simpan HttpOnly cookie)
- Gagal: tampilkan Ant Design message.error

ProtectedRoute:
- Mount: panggil GET /admin/auth/me
- Jika 401: redirect ke /login
- Jika sukses: render children + simpan user info di context

useAuth hook: expose user, isLoading, logout() function.

Simpan current user di React Context agar accessible di semua page (untuk disable delete diri sendiri)." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "FE-2: $FE2"

FE3=$(bd create "API Key management page" \
  -t feature -p 2 -l ready-for-agent \
  -d "Halaman /api-keys. File: src/pages/ApiKeysPage.tsx.

Table columns: id (8 char prefix masked), client_name, allowed_from_addresses (Ant Design Tags), is_active (Badge: Active=green/Inactive=red), expires_at (humanized atau Never), created_at.

Aksi:
- Create: Modal form (client_name required, allowed_from_addresses input multi-tag, expires_at DatePicker optional). Setelah sukses tampilkan Modal khusus dengan key_token lengkap + Copy button (peringatan: hanya tampil sekali).
- Toggle is_active: Switch per baris, PATCH /admin/api-keys/{id}
- Edit: Modal isi ulang fields (KECUALI key_token), PATCH /admin/api-keys/{id}
- Delete: Ant Design Popconfirm, DELETE /admin/api-keys/{id}

Data: React Query useQuery + useMutation. Invalidate cache setelah mutasi." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "FE-3: $FE3"

FE4=$(bd create "User management page" \
  -t feature -p 2 -l ready-for-agent \
  -d "Halaman /users. File: src/pages/UsersPage.tsx.

Table columns: username, created_at, actions.

Aksi:
- Create user: Modal form (username, password min 8 char, confirm password). POST /admin/users.
- Reset password: Modal form (new_password, confirm). PUT /admin/users/{id}/password.
- Delete: Ant Design Popconfirm. DELETE /admin/users/{id}. Tombol DELETE di-disabled jika id == current user (dari useAuth context).

Data: React Query useQuery + useMutation." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "FE-4: $FE4"

FE5=$(bd create "Log monitoring page with 30s auto-polling" \
  -t feature -p 2 -l ready-for-agent \
  -d "Halaman /logs. File: src/pages/LogsPage.tsx.

Table columns: task_id (8 char prefix), from_address, to_addresses (join dengan koma, max 2 tampil), subject (truncate 50 char), status (Badge: queued=blue/sent=green/failed=red), retry_count, created_at, delivered_at.

Filter bar (di atas table):
- Select status: queued/sent/failed/all
- RangePicker: from_date - to_date
- Select API Key: fetch dari GET /admin/api-keys, tampilkan client_name
- Input search subject dengan debounce 500ms

Pagination: Ant Design Table pagination, sync ke query params page + page_size.
Auto-refresh: React Query refetchInterval: 30000 (30 detik). Tampilkan indikator 'Last updated: Xs ago'." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "FE-5: $FE5"

# ============================================================
# GROUP 7 — Docker & Deploy
# ============================================================

INFRA1=$(bd create "Update docker-compose.yml to add frontend service" \
  -t task -p 3 -l ready-for-agent \
  -d "Update docker-compose.yml:

1. Tambah service 'frontend':
   build: ./frontend
   ports: '3000:80'
   depends_on: [api]
   environment: VITE_API_URL=http://localhost:8000

2. Tambah env var ke service 'api':
   - ALLOWED_ORIGINS=http://localhost:3000
   - ADMIN_USERNAME (dari .env)
   - ADMIN_PASSWORD (dari .env)

3. Update .env.example dengan semua variable baru:
   ALLOWED_ORIGINS=http://localhost:3000
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=changeme123
   VITE_API_URL=http://localhost:8000

4. Update README.md: tambah section Quick Start untuk Dashboard." \
  | grep -oE 'email-gateway-[a-z0-9]+')
echo "INFRA-1: $INFRA1"

# ============================================================
# DEPENDENCIES
# ============================================================

echo ""
echo "==> Menambahkan dependency graph..."

# BE-5 depends on BE-1 (bootstrap needs AdminUser model)
bd dep add $BE5 $BE1

# BE-6 depends on BE-3 (expires_at check needs expires_at column)
bd dep add $BE6 $BE3

# BE-7 depends on BE-1, BE-2, BE-5 (auth needs user+session model+bootstrap)
bd dep add $BE7 $BE1
bd dep add $BE7 $BE2
bd dep add $BE7 $BE5
bd dep add $BE7 $BE4

# BE-8 depends on BE-7 (user mgmt needs auth)
bd dep add $BE8 $BE7

# BE-9 depends on BE-7, BE-3 (api key mgmt needs auth + expires_at)
bd dep add $BE9 $BE7
bd dep add $BE9 $BE3

# BE-10 depends on BE-7 (transactions needs auth)
bd dep add $BE10 $BE7

# FE-2 depends on BE-7, FE-1
bd dep add $FE2 $BE7
bd dep add $FE2 $FE1

# FE-3 depends on BE-9, FE-1
bd dep add $FE3 $BE9
bd dep add $FE3 $FE1

# FE-4 depends on BE-8, FE-1
bd dep add $FE4 $BE8
bd dep add $FE4 $FE1

# FE-5 depends on BE-10, FE-1
bd dep add $FE5 $BE10
bd dep add $FE5 $FE1

# INFRA-1 depends on all FE pages
bd dep add $INFRA1 $FE2
bd dep add $INFRA1 $FE3
bd dep add $INFRA1 $FE4
bd dep add $INFRA1 $FE5

echo ""
echo "==> Selesai! Menampilkan daftar issues:"
bd list --status=open

echo ""
echo "==> Issues siap diambil (no blockers):"
bd ready
