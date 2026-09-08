**Product Requirements Document (PRD): Centralized Email Gateway API**

**Dokumen:** Versi 1.0
**Pemilik Proyek:** Bagus Sudrajat (Kent Os)
**Tanggal:** September 2026

---

## 1. Ringkasan Eksekutif

Aplikasi *Email Gateway* adalah *microservice* berbasis REST API yang berfungsi sebagai agen tunggal pengiriman email untuk seluruh aplikasi internal (seperti sistem *billing*, HRIS, portal *training*). Sistem ini memisahkan beban kerja SMTP yang lambat dari aplikasi *client*, mencegah *timeout*, dan menghilangkan kebutuhan *setup* kredensial SMTP yang berulang di setiap aplikasi.

## 2. Arsitektur & Teknologi

Sistem ini menggunakan arsitektur *asynchronous* berbasis *task queue*.

* **Web Framework:** FastAPI
* **Message Broker:** Redis
* **Worker Engine:** Celery (connection-per-task SMTP — koneksi dibuka, digunakan, dan ditutup per task menggunakan *context manager*)
* **Database:** PostgreSQL (menyimpan API Keys dan Mail Transactions)
* **ORM & Migrations:** SQLAlchemy (sync) + Alembic
* **Logging:** structlog (JSON structured logging)
* **Protokol:** SMTP dengan TLS (STARTTLS)

## 3. Spesifikasi Fitur (Functional Requirements)

* **Autentikasi Klien:** API harus memvalidasi keberadaan dan keabsahan *header* `X-API-Key` sebelum memproses *request*. Kunci yang tidak valid akan langsung mengembalikan HTTP 401 Unauthorized.
* **Validasi Payload:** Sistem harus memvalidasi struktur JSON secara ketat. Jika alamat email *malformed* atau *field* wajib kosong, API akan mengembalikan HTTP 422 Unprocessable Entity.
* **Queuing & Background Processing:** API selalu mengembalikan HTTP 202 Accepted sesegera mungkin setelah menaruh *payload* ke Redis, tanpa menunggu email benar-benar terkirim oleh SMTP.
* **Fleksibilitas Konten:** Sistem harus mampu merender format `text/plain`, `text/html`, dan membaca *array* dari objek *file* yang di-enkode menggunakan Base64.
* **Automatic Retry:** Celery *worker* harus dikonfigurasi untuk melakukan **3x retry** dengan skema *exponential backoff* jika *server* SMTP tujuan mengalami *timeout* atau gangguan koneksi (*connection refused*). Jeda antar percobaan (countdown): **60 detik → 300 detik → 900 detik** (total 4 percobaan pengiriman termasuk percobaan awal).
* **From Address per Client:** Setiap Email Request wajib menyertakan field `from_address` berupa alamat email pengirim. Gateway memvalidasi bahwa `from_address` terdaftar dalam whitelist `allowed_from_addresses` milik Client yang mengirim request. Jika tidak terdaftar, gateway mengembalikan HTTP 403 Forbidden.
* **Status Tracking:** Gateway menyediakan endpoint `GET /api/v1/emails/{task_id}` yang mengembalikan Delivery Status dari Mail Transaction berdasarkan `task_id` yang diterima saat pengiriman.
* **Audit Trail:** Setiap Email Request yang diterima gateway dicatat sebagai Mail Transaction di database PostgreSQL. Field yang disimpan: `client_id`, `task_id`, `to_addresses`, `cc_addresses`, `subject`, `from_address`, `attachment_count`, `status`, `error_message`, `retry_count`, `created_at`, `delivered_at`. Konten email dan binary attachment tidak disimpan.

## 4. Kinerja & Keamanan (Non-Functional Requirements)

| Kategori | Spesifikasi |
| --- | --- |
| **Kinerja (Throughput)** | *Worker* harus mempertahankan koneksi SMTP (*persistent connection*) selama siklus hidupnya atau *batch processing* untuk menghilangkan latensi *handshake* berulang saat *blast* massal. |
| **Batas Ukuran (Rate Limit/Size)** | Batas 15 MB merujuk pada **ukuran total JSON payload** (termasuk overhead Base64 ~37%). Artinya batas *raw file attachment* adalah sekitar 10.5 MB. *Enforcement* dilakukan di dua lapis: Nginx (`client_max_body_size 15m`) dan Pydantic *validator*. |
| **Isolasi Kegagalan** | Matinya satu *worker* Celery atau gagalnya *server* SMTP tidak boleh menyebabkan aplikasi *client* *error*. Pesan tetap aman di dalam Redis. |
| **SMTP Error Permanen** | Jika SMTP server mengembalikan error permanen `552 5.3.4 Message size exceeds fixed maximum message size`, *worker* langsung menandai Mail Transaction sebagai `failed` tanpa retry. |

## 5. Desain Kontrak API

**Endpoint 1:** `POST /api/v1/emails/send`
**Headers:**

* `Content-Type: application/json`
* `X-API-Key: <static-client-key>`

**Struktur Payload (JSON):**

```json
{
  "from_address": "billing@domain.com",
  "to": ["user@domain.com", "finance@domain.com"],
  "cc": ["manager@domain.com"], 
  "subject": "Invoice Tagihan Internet - September 2026",
  "text_content": "Berikut adalah tagihan Anda...",
  "html_content": "<strong>Berikut adalah tagihan Anda...</strong>",
  "attachments": [
    {
      "filename": "invoice_september.pdf",
      "content_type": "application/pdf",
      "base64_data": "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVu..."
    }
  ]
}
```

*(Catatan: `text_content` dan `html_content` bersifat opsional, tetapi minimal salah satu harus ada).*

---

**Endpoint 2:** `GET /api/v1/emails/{task_id}`
**Headers:**

* `X-API-Key: <static-client-key>`

**Response (200 OK):**

```json
{
  "task_id": "uuid",
  "status": "queued|sent|failed",
  "from_address": "billing@domain.com",
  "to": ["user@domain.com"],
  "subject": "...",
  "retry_count": 0,
  "error_message": null,
  "created_at": "2026-09-08T10:00:00Z",
  "delivered_at": "2026-09-08T10:00:05Z"
}
```

## 6. Out of Scope (Di Luar Cakupan Rilis V1)

* Pembuatan GUI/Dashboard Web untuk admin (semua manajemen API Key V1 dilakukan via *environment variables* atau modifikasi *database* langsung).
* Fitur *tracking* buka/klik (*Open/Click Tracking*) menggunakan *tracking pixel*.
* *Template engine* internal (Jinja2) di sisi *gateway*.