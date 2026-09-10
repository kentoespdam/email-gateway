# Centralized Email Gateway API

FastAPI + Celery + PostgreSQL service that accepts email-send requests over
HTTP, queues them, and delivers them via SMTP (connection-per-task).

## Stack

- **API**: FastAPI, Pydantic V2 (`app/`)
- **Worker**: Celery + Redis, smtplib with STARTTLS (`worker/`)
- **DB**: PostgreSQL 16, SQLAlchemy 2, Alembic (`app/models.py`, `alembic/`)
- **Dashboard**: React + Vite + TypeScript, Ant Design, TanStack Query (`frontend/`)
- **Toolchain**: `uv` for Python, `bun` for frontend (`uv sync`, `bun install`)

## Quick start

```bash
uv sync                      # install dependencies
docker compose up -d         # Jalankan DB, Redis, Worker, API (8000), FE (3000)
# Opsi stack development (termasuk pgAdmin):
# docker compose --profile development up -d (atau: make docker-up-dev)
# Migrasi tabel kini berjalan otomatis saat api menyala berkat healthcheck database
make db-seed                 # seed an API key via docker container
```

> **Catatan Migrasi Database:** Migrasi tabel (`alembic upgrade head`) kini berjalan otomatis saat service `api` menyala berkat healthcheck database (`condition: service_healthy`). Perintah `make db-migrate` tetap dapat dijalankan secara manual jika diperlukan.

> **Catatan Jaringan & Port:** Secara default, port PostgreSQL (5432) dan Redis (6379) tidak di-expose ke host dan hanya dapat diakses melalui internal Docker network. Untuk development lokal (mengekspos port 5432 dan 6379 ke host), buat file `docker-compose.override.yml`:
> ```bash
> cp docker-compose.override.yml.example docker-compose.override.yml
> docker compose up -d
> ```
> Docker Compose akan otomatis menggabungkan konfigurasi override tersebut saat menjalankan `docker compose up`. Jika tidak menggunakan override, gunakan `make db-shell` / `make redis-shell`.

## Dashboard (Admin UI)
Dashboard dapat diakses di http://localhost:3000.

Login pertama menggunakan `ADMIN_USERNAME` dan `ADMIN_PASSWORD` dari env.

### Local Development (Tanpa Docker)

Jika menjalankan backend di host namun menggunakan database & Redis dari Docker Compose, pastikan port PostgreSQL (5432) dan Redis (6379) sudah di-expose menggunakan `docker-compose.override.yml`.

```bash
# Jalankan PostgreSQL & Redis dengan port exposed via override
docker compose up -d postgres redis

# Backend
uv run uvicorn app.main:app --port 8000

# Frontend
cd frontend
bun install
bun dev          # buka http://localhost:5173
```

## Database Management (pgAdmin)

pgAdmin disediakan untuk mempermudah manajemen database PostgreSQL melalui UI web menggunakan profile Docker Compose `development`.

### Menjalankan pgAdmin
```bash
docker compose --profile development up -d
# atau menggunakan Makefile:
make docker-up-dev
```

### Akses & Kredensial
- **URL**: [http://localhost:88](http://localhost:88)
- **Email Default (`PGADMIN_DEFAULT_EMAIL`)**: `admin@example.com`
- **Password Default (`PGADMIN_DEFAULT_PASSWORD`)**: `pgadminpassword`

## Testing

```bash
# Backend (Pytest)
uv run pytest

# Frontend (Vitest)
cd frontend
npx vitest run
```

## API

All endpoints require the `X-API-Key` header.

### Send an email

```bash
curl -X POST localhost:8000/api/v1/emails/send \
  -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{
    "from_address": "noreply@example.com",
    "to": ["dest@example.com"],
    "cc": ["other@example.com"],
    "subject": "Hello",
    "text_content": "plain body",
    "html_content": "<p>html body</p>",
    "attachments": [{"filename": "f.txt", "content_type": "text/plain", "base64_data": "..."}]
  }'
```

- `202` → `{"task_id": "...", "status": "queued"}` (job queued to Celery)
- `401` unknown/inactive key · `403` sender not whitelisted · `422` invalid payload
  (no body, bad address, attachments over 15 MB total)

### Track status

```bash
curl localhost:8000/api/v1/emails/<task_id> -H "X-API-Key: <key>"
```

Returns `status` (`queued` | `sent` | `failed`), `retry_count`,
`error_message`, `created_at`, `delivered_at`. `404` if unknown or owned by
another client.

## Seeded test key

A key is seeded in the local Postgres for manual testing:

| | |
|---|---|
| Key | `e2e-test-key-0123456789abcdef` |
| Client | `e2e-test` |
| Allowed senders | `noreply@example.com` |

Re-seed or add more keys with the idempotent script:

```bash
uv run scripts/seed_api_key.py [token] [client_name] [allowed_from ...]
# no args → generates a random token for client "manual-test"
```

**Local-only**: never use this key outside your machine.

## E2E verification scripts

### `scripts/smtp_sink.py`

Local SMTP sink (aiosmtpd) on `127.0.0.1:8025`. Accepts any mail and appends
it to `/tmp/smtp_sink_out.txt` — use it as the delivery target instead of a
real SMTP server.

### Full E2E run

```bash
# 1. sink (instead of real SMTP)
uv run scripts/smtp_sink.py

# 2. worker pointed at the sink
SMTP_HOST=127.0.0.1 SMTP_PORT=8025 SMTP_USE_TLS=false \
DATABASE_URL=postgresql+psycopg2://gateway:gateway@localhost:5432/email_gateway \
REDIS_URL=redis://localhost:6379/0 \
uv run celery -A worker.celery_app worker --loglevel=INFO --pool=solo

# 3. API
DATABASE_URL=postgresql+psycopg2://gateway:gateway@localhost:5432/email_gateway \
uv run uvicorn app.main:app --port 8000

# 4. send + poll
curl -X POST localhost:8000/api/v1/emails/send \
  -H "X-API-Key: e2e-test-key-0123456789abcdef" -H "Content-Type: application/json" \
  -d '{"from_address":"noreply@example.com","to":["dest@example.com"],"subject":"E2E smoke","text_content":"hello"}'

curl localhost:8000/api/v1/emails/<task_id> -H "X-API-Key: e2e-test-key-0123456789abcdef"
# → {"status": "sent", ...}; message body lands in /tmp/smtp_sink_out.txt
```

## Worker retry semantics

- SMTP `552` → permanent failure, transaction marked `failed` immediately, no retry
- Transient errors (timeout, connection refused) → ordered retries after
  **60s, 300s, 900s** (max 3), `retry_count` updated in DB each attempt
- Each attempt opens a fresh SMTP connection (connection-per-task)

## Development

```bash
uv run pytest          # tests (23)
uv run ruff check app worker tests scripts
uv run mypy            # typechecks app/ and worker/
```

File-size budget: 150–250 LOC ideal, 300 hard limit (see `CODING_RULES.md`).
