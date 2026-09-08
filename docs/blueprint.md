### 1. Struktur Folder (Project Layout)

Tata letak ini memisahkan antara lapisan *routing* API, validasi data, dan *background worker*.

```text
email_gateway/
├── app/
│   ├── __init__.py
│   ├── main.py              # Titik masuk FastAPI & Endpoint HTTP
│   ├── schemas.py           # Validasi payload menggunakan Pydantic V2
│   ├── security.py          # Logika verifikasi X-API-Key
│   └── worker/
│       ├── __init__.py
│       ├── celery_app.py    # Konfigurasi Message Broker (Redis)
│       └── tasks.py         # Logika Celery, SMTP Persistent Pooling, & Retry
├── .env                     # Variabel konfigurasi kredensial SMTP & API Keys
├── requirements.txt         # fastapi, celery, redis, pydantic, uvicorn
└── docker-compose.yml       # Konfigurasi container untuk Redis Server

```

---

### 2. Validasi Payload (app/schemas.py)

Menggunakan standar Pydantic V2. Validasi ini akan memastikan format email sudah benar dan salah satu dari teks atau HTML selalu terisi sebelum pesan dikirim ke Redis.

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
    subject: str = Field(..., min_length=1)
    text_content: Optional[str] = None
    html_content: Optional[str] = None
    attachments: Optional[List[Attachment]] = []

    @model_validator(mode='after')
    def check_content(self):
        # Mencegah payload kosong (tanpa body content)
        if not self.text_content and not self.html_content:
            raise ValueError('Minimal salah satu (text_content atau html_content) harus diisi')
        return self

```

---

### 3. REST API Endpoint (app/main.py)

Ini adalah "pintu gerbang" aplikasi. *Endpoint* ini didesain ringan; ia tidak melakukan proses *blocking* SMTP sama sekali, melainkan langsung mendelegasikan tugas ke Celery dengan mengembalikan status `202 Accepted`.

```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from app.schemas import EmailPayload
from app.worker.tasks import send_email_task
import os

app = FastAPI(
    title="Centralized Email Gateway API",
    description="Layanan antrean pengiriman email untuk internal apps.",
    version="1.0.0"
)

# Simulasi sederhana validasi API Key (idealnya ini divalidasi ke database)
header_scheme = APIKeyHeader(name="X-API-Key")
VALID_API_KEYS = os.getenv("VALID_API_KEYS", "secret-key-1,secret-key-2").split(",")

def verify_api_key(api_key: str = Depends(header_scheme)):
    if api_key not in VALID_API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key tidak valid atau telah dicabut"
        )
    return api_key

@app.post("/api/v1/emails/send", status_code=status.HTTP_202_ACCEPTED)
async def push_email_to_queue(
    payload: EmailPayload,
    api_key: str = Depends(verify_api_key)
):
    # Payload model di-dump menjadi dictionary mentah agar bisa di-serialize oleh Redis
    task = send_email_task.delay(payload.model_dump())
    
    return {
        "status": "accepted",
        "message": "Pesan telah masuk ke dalam antrean pengiriman.",
        "task_id": task.id
    }

```

---

### 4. Worker & SMTP Persistent Connection (app/worker/tasks.py)

Ini adalah bagian terpenting dari arsitektur *gateway*. Koneksi SMTP hanya dibuka **satu kali** saat *worker process* menyala (via `worker_process_init`). Semua *request* email yang masuk akan memakai ulang koneksi tersebut.

Jika *handshake* ke SMTP *timeout*, *worker* akan melakukan *Exponential Backoff* (menunggu 1 menit, lalu 5 menit, dst.) sebelum mencoba lagi.

```python
import smtplib
import base64
import os
from email.message import EmailMessage
from celery import Celery
from celery.signals import worker_process_init, worker_process_shutdown

# Inisialisasi koneksi ke broker Redis
celery_app = Celery("email_worker", broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"))

# Variabel global untuk menyimpan state koneksi SMTP di dalam memori worker
smtp_connection = None

def init_smtp():
    """Fungsi bantuan untuk menyalakan ulang koneksi jika terputus."""
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", 587))
    conn = smtplib.SMTP(host, port)
    conn.starttls()
    conn.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS"))
    return conn

@worker_process_init.connect
def on_worker_start(**kwargs):
    global smtp_connection
    try:
        smtp_connection = init_smtp()
        print("Worker berhasil membuka koneksi persisten ke server SMTP.")
    except Exception as e:
        print(f"Gagal melakukan koneksi awal ke SMTP: {e}")

@worker_process_shutdown.connect
def on_worker_stop(**kwargs):
    global smtp_connection
    if smtp_connection:
        smtp_connection.quit()

@celery_app.task(bind=True, max_retries=3)
def send_email_task(self, payload: dict):
    global smtp_connection
    
    # 1. Merakit format email standar MIME
    msg = EmailMessage()
    msg['Subject'] = payload.get('subject')
    msg['From'] = os.getenv("SMTP_FROM", "system@domain.com")
    msg['To'] = ", ".join(payload.get('to', []))
    
    if payload.get('cc'):
        msg['Cc'] = ", ".join(payload.get('cc'))
        
    text_content = payload.get('text_content')
    html_content = payload.get('html_content')
    
    # Prioritaskan menyisipkan teks fallback, lalu HTML
    if text_content:
        msg.set_content(text_content)
        if html_content:
            msg.add_alternative(html_content, subtype='html')
    elif html_content:
        msg.set_content(html_content, subtype='html')
        
    # 2. Sisipkan attachments biner (contoh: struk tagihan PDF)
    for attachment in payload.get('attachments', []):
        file_data = base64.b64decode(attachment['base64_data'])
        maintype, subtype = attachment['content_type'].split('/', 1)
        msg.add_attachment(
            file_data, 
            maintype=maintype, 
            subtype=subtype, 
            filename=attachment['filename']
        )
        
    # 3. Proses Pengiriman dengan penanganan putus koneksi
    try:
        # Cek apakah koneksi SMTP masih hidup, idle timeout dari server sering memutus koneksi
        try:
            status_code = smtp_connection.noop()[0]
            if status_code != 250:
                raise smtplib.SMTPServerDisconnected
        except Exception:
            # Re-connect secara halus tanpa membatalkan task
            smtp_connection = init_smtp()
            
        smtp_connection.send_message(msg)
        
    except Exception as exc:
        # Jika server SMTP benar-benar mati/gangguan, lakukan Exponential Backoff
        # Retries: percobaan 1 (tunggu 1 menit), percobaan 2 (tunggu 5 menit)
        countdown_timer = 60 * (5 ** self.request.retries) 
        raise self.retry(exc=exc, countdown=countdown_timer)

```

Dengan struktur ini, modul lain hanya perlu mengarahkan JSON *payload* mereka ke `/api/v1/emails/send` dan melampirkan `X-API-Key`. Konfigurasi basis kodenya cukup ringan namun sudah siap menangani beban antrean masif.
