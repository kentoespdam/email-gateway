### 1. Struktur Folder (Project Layout)

Tata letak ini memisahkan antara lapisan *routing* API, validasi data, ORM, dan *background worker*. Dibandingkan blueprint awal, ditambahkan `models.py`, `database.py`, direktori `alembic/`, dan `tests/`.

```text
email_gateway/
├── app/
│   ├── __init__.py
│   ├── main.py              # Titik masuk FastAPI & dua Endpoint HTTP
│   ├── schemas.py           # Validasi payload menggunakan Pydantic V2
│   ├── security.py          # Logika verifikasi X-API-Key & from_address whitelist
│   ├── models.py            # SQLAlchemy models: ApiKey, MailTransaction
│   ├── database.py          # Engine PostgreSQL + SessionLocal
│   └── worker/
│       ├── __init__.py
│       ├── celery_app.py    # Konfigurasi Message Broker (Redis)
│       └── tasks.py         # Celery task: connection-per-task SMTP & Retry
├── alembic/                 # Migrasi schema database
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── tests/
│   ├── __init__.py
│   ├── test_api.py
│   └── test_tasks.py
├── .env                     # SMTP credentials, DB URL, Redis URL
├── pyproject.toml           # Dependency management via uv
└── docker-compose.yml       # Redis + PostgreSQL + Celery Worker
```

---

### 2. Dependency Stack (pyproject.toml)

```toml
[project]
name = "email-gateway"
version = "1.0.0"
requires-python = ">=3.11"
dependencies = [
    # Core
    "fastapi",
    "uvicorn[standard]",
    # Validation & Settings
    "pydantic[email]",
    "pydantic-settings",
    # Database
    "sqlalchemy",
    "psycopg2-binary",
    "alembic",
    # Queue & Worker
    "celery[redis]",
    "redis",
    # Logging
    "structlog",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "httpx",
    "pytest-mock",
]
```

---

### 3. Validasi Payload (app/schemas.py)

`from_address` adalah field wajib. `bcc` tidak ada di V1.

```python
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import List, Optional

class Attachment(BaseModel):
    filename: str
    content_type: str = Field(..., examples=["application/pdf", "image/png"])
    base64_data: str

class EmailPayload(BaseModel):
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = []
    from_address: EmailStr                    # Wajib; divalidasi ke whitelist Client
    subject: str = Field(..., min_length=1)
    text_content: Optional[str] = None
    html_content: Optional[str] = None
    attachments: Optional[List[Attachment]] = []

    @model_validator(mode='after')
    def check_content(self):
        if not self.text_content and not self.html_content:
            raise ValueError('Minimal salah satu (text_content atau html_content) harus diisi')
        return self

    @model_validator(mode='after')
    def check_payload_size(self):
        # Estimasi cepat ukuran Base64 tanpa decode
        total_b64_len = sum(len(a.base64_data) for a in (self.attachments or []))
        estimated_raw = (total_b64_len * 3) // 4
        max_bytes = 10 * 1024 * 1024  # ~10.5 MB raw ≈ 15 MB JSON payload
        if estimated_raw > max_bytes:
            raise ValueError('Total ukuran attachment melebihi batas maksimal')
        return self
```

---

### 4. Database Models (app/models.py)

```python
from sqlalchemy import Column, String, Integer, DateTime, ARRAY, Text
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone

class Base(DeclarativeBase):
    pass

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True)          # UUID
    key = Column(String, unique=True, nullable=False)
    client_name = Column(String, nullable=False)
    allowed_from_addresses = Column(ARRAY(String), nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class MailTransaction(Base):
    __tablename__ = "mail_transactions"

    id = Column(String, primary_key=True)          # UUID
    task_id = Column(String, unique=True, nullable=False)
    client_id = Column(String, nullable=False)
    from_address = Column(String, nullable=False)
    to_addresses = Column(ARRAY(String), nullable=False)
    cc_addresses = Column(ARRAY(String), default=[])
    subject = Column(String, nullable=False)
    attachment_count = Column(Integer, default=0)
    status = Column(String, default="queued")      # queued | sent | failed
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    delivered_at = Column(DateTime, nullable=True)
```

---

### 5. REST API Endpoints (app/main.py)

Dua endpoint: satu untuk mengirim, satu untuk query status.

```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from app.schemas import EmailPayload
from app.database import get_db
from app.models import ApiKey, MailTransaction
from app.worker.tasks import send_email_task
import structlog, uuid

log = structlog.get_logger()
app = FastAPI(title="Centralized Email Gateway API", version="1.0.0")
header_scheme = APIKeyHeader(name="X-API-Key")

def get_api_key(api_key: str = Depends(header_scheme), db: Session = Depends(get_db)) -> ApiKey:
    record = db.query(ApiKey).filter_by(key=api_key, is_active=1).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API Key tidak valid")
    return record

@app.post("/api/v1/emails/send", status_code=status.HTTP_202_ACCEPTED)
def push_email_to_queue(
    payload: EmailPayload,
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db)
):
    # Validasi from_address terhadap whitelist client
    if payload.from_address not in api_key.allowed_from_addresses:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="from_address tidak diizinkan untuk API Key ini")

    task_id = str(uuid.uuid4())
    # Catat Mail Transaction awal
    tx = MailTransaction(
        id=str(uuid.uuid4()), task_id=task_id,
        client_id=api_key.id, from_address=payload.from_address,
        to_addresses=payload.to, cc_addresses=payload.cc or [],
        subject=payload.subject,
        attachment_count=len(payload.attachments or []),
    )
    db.add(tx); db.commit()

    send_email_task.apply_async(args=[payload.model_dump()], task_id=task_id)
    log.info("email_queued", task_id=task_id, client=api_key.client_name)
    return {"status": "accepted", "task_id": task_id}

@app.get("/api/v1/emails/{task_id}")
def get_email_status(task_id: str, db: Session = Depends(get_db),
                     api_key: ApiKey = Depends(get_api_key)):
    tx = db.query(MailTransaction).filter_by(task_id=task_id, client_id=api_key.id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Task tidak ditemukan")
    return {"task_id": tx.task_id, "status": tx.status, "retry_count": tx.retry_count,
            "error_message": tx.error_message, "created_at": tx.created_at,
            "delivered_at": tx.delivered_at}
```

---

### 6. Worker & SMTP Connection-per-Task (app/worker/tasks.py)

Koneksi SMTP dibuka, digunakan, dan ditutup per task via context manager. Tidak ada global state.
SMTP error `552` (ukuran melebihi batas) adalah *permanent failure* — tidak di-retry.

```python
import smtplib, base64, os
from email.message import EmailMessage
from celery import Celery
from app.database import SessionLocal
from app.models import MailTransaction
from datetime import datetime, timezone
import structlog

log = structlog.get_logger()
celery_app = Celery("email_worker", broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
RETRY_COUNTDOWN = [60, 300, 900]  # detik: 1 menit, 5 menit, 15 menit

@celery_app.task(bind=True, max_retries=3)
def send_email_task(self, payload: dict):
    task_id = self.request.id

    # Rakit pesan MIME
    msg = EmailMessage()
    msg['Subject'] = payload['subject']
    msg['From'] = payload['from_address']
    msg['To'] = ", ".join(payload['to'])
    if payload.get('cc'):
        msg['Cc'] = ", ".join(payload['cc'])

    if payload.get('text_content'):
        msg.set_content(payload['text_content'])
        if payload.get('html_content'):
            msg.add_alternative(payload['html_content'], subtype='html')
    elif payload.get('html_content'):
        msg.set_content(payload['html_content'], subtype='html')

    for att in payload.get('attachments', []):
        file_data = base64.b64decode(att['base64_data'])
        maintype, subtype = att['content_type'].split('/', 1)
        msg.add_attachment(file_data, maintype=maintype, subtype=subtype, filename=att['filename'])

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", 587))

    try:
        with smtplib.SMTP(host, port, timeout=15) as conn:
            conn.starttls()
            conn.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS"))
            conn.send_message(msg)

        _update_status(task_id, "sent", delivered_at=datetime.now(timezone.utc))
        log.info("email_sent", task_id=task_id)

    except smtplib.SMTPResponseException as exc:
        if exc.smtp_code == 552:
            # Permanent failure — jangan retry
            log.error("email_permanent_fail", task_id=task_id, code=552, error=str(exc))
            _update_status(task_id, "failed", error=str(exc))
            return
        _handle_retry(self, exc, task_id)
    except Exception as exc:
        _handle_retry(self, exc, task_id)

def _handle_retry(task, exc, task_id):
    retry_num = task.request.retries
    countdown = RETRY_COUNTDOWN[retry_num] if retry_num < len(RETRY_COUNTDOWN) else 900
    log.warning("email_retry", task_id=task_id, retry=retry_num + 1, countdown=countdown)
    _update_status(task_id, "queued", retry_count=retry_num + 1, error=str(exc))
    raise task.retry(exc=exc, countdown=countdown)

def _update_status(task_id, status, delivered_at=None, error=None, retry_count=None):
    with SessionLocal() as db:
        tx = db.query(MailTransaction).filter_by(task_id=task_id).first()
        if tx:
            tx.status = status
            if error: tx.error_message = error
            if delivered_at: tx.delivered_at = delivered_at
            if retry_count is not None: tx.retry_count = retry_count
            db.commit()
```

---

### 7. Docker Compose (docker-compose.yml)

Service `pgadmin` menggunakan profile `development` sehingga tidak otomatis berjalan saat `docker compose up -d` biasa, menghemat resource jika hanya dibutuhkan saat debugging atau inspeksi database. Jalankan dengan `docker compose --profile development up -d` atau `make docker-up-dev`.

```yaml
services:
  redis:
    image: redis:7
    ports: ["6379:6379"]

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: email_gateway
      POSTGRES_USER: gateway
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin_web
    restart: always
    profiles:
      - development
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_DEFAULT_EMAIL:-admin@example.com}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_DEFAULT_PASSWORD:-pgadminpassword}
    ports: ["88:80"]
    volumes: ["pgadmin_data:/var/lib/pgadmin"]
    depends_on: [postgres]

  celery_worker:
    build: .
    command: celery -A worker.celery_app worker --loglevel=info
    environment:
      REDIS_URL: redis://redis:6379/0
    depends_on: [redis, postgres]

  api:
    build: .
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    environment:
      DATABASE_URL: postgresql+psycopg2://gateway:gateway@postgres:5432/email_gateway
      REDIS_URL: redis://redis:6379/0
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:5173}
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-changeme123}
    ports: ["8000:8000"]
    depends_on: [postgres, redis]

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports: ["3000:80"]
    depends_on: [api]

volumes:
  pgdata:
  pgadmin_data:
```

